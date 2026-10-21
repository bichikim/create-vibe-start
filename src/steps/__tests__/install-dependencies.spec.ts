import {join} from 'node:path'
import {beforeEach, describe, expect, it, vi} from 'vitest'

const commandExistsMock = vi.fn()
const runCommandMock = vi.fn()
const runCommandQuietlyMock = vi.fn()
const mkdirMock = vi.hoisted(() => vi.fn())
const writeFileMock = vi.hoisted(() => vi.fn())

vi.mock('../../utils/command-exists.js', () => ({
  commandExists: commandExistsMock,
}))

vi.mock('../../utils/run-command.js', () => ({
  runCommand: runCommandMock,
  runCommandQuietly: runCommandQuietlyMock,
}))

vi.mock('node:fs/promises', () => ({
  mkdir: mkdirMock,
  writeFile: writeFileMock,
}))

describe('installDependencies', () => {
  beforeEach(() => {
    commandExistsMock.mockReset()
    runCommandMock.mockReset().mockResolvedValue(undefined)
    runCommandQuietlyMock.mockReset()
    mkdirMock.mockReset().mockResolvedValue(undefined)
    writeFileMock.mockReset().mockResolvedValue(undefined)
  })

  it('uses PATH pnpm when it supports catalogs', async () => {
    commandExistsMock.mockResolvedValue(true)
    runCommandQuietlyMock.mockResolvedValue({stdout: '11.1.2\n'})
    const {installDependencies} = await import('../install-dependencies')

    await expect(installDependencies('/repo')).resolves.toBe(true)

    expect(commandExistsMock).toHaveBeenCalledWith('pnpm')
    expect(runCommandQuietlyMock).toHaveBeenCalledWith('pnpm', ['--version'])
    expect(runCommandMock).toHaveBeenNthCalledWith(1, 'pnpm', ['i'], 'pnpm i', '/repo')
    expect(mkdirMock).toHaveBeenCalledWith(join('/repo', 'apps/main-app/android/app/src/main/assets'), {
      recursive: true,
    })
    expect(mkdirMock).toHaveBeenCalledWith(join('/repo', 'apps/main-app/dist'), {recursive: true})
    expect(writeFileMock).toHaveBeenCalledWith(
      join('/repo', 'apps/main-app/dist/index.html'),
      '<!doctype html><title>vibe</title>\n',
    )
    expect(runCommandMock).toHaveBeenNthCalledWith(
      2,
      'pnpm',
      ['exec', 'cap', 'update', 'android'],
      'pnpm exec cap update android',
      join('/repo', 'apps/main-app'),
    )
  })

  it('uses Corepack pnpm when PATH pnpm is too old for catalogs', async () => {
    commandExistsMock.mockResolvedValue(true)
    runCommandQuietlyMock.mockResolvedValue({stdout: '7.29.1'})
    const {installDependencies} = await import('../install-dependencies')

    await expect(installDependencies('/repo')).resolves.toBe(true)

    expect(runCommandQuietlyMock).toHaveBeenCalledWith('pnpm', ['--version'])
    expect(runCommandMock).toHaveBeenNthCalledWith(1, 'corepack', ['pnpm@11.1.2', 'i'], 'pnpm i', '/repo')
    expect(runCommandMock).toHaveBeenNthCalledWith(
      2,
      'corepack',
      ['pnpm@11.1.2', 'exec', 'cap', 'update', 'android'],
      'pnpm exec cap update android',
      join('/repo', 'apps/main-app'),
    )
  })

  it('uses Corepack pnpm when pnpm is unavailable', async () => {
    commandExistsMock.mockImplementation(async (command: string) => command === 'corepack')
    const {installDependencies} = await import('../install-dependencies')

    await expect(installDependencies('/repo')).resolves.toBe(true)

    expect(commandExistsMock).toHaveBeenNthCalledWith(1, 'pnpm')
    expect(commandExistsMock).toHaveBeenNthCalledWith(2, 'corepack')
    expect(runCommandQuietlyMock).not.toHaveBeenCalled()
    expect(runCommandMock).toHaveBeenNthCalledWith(1, 'corepack', ['pnpm@11.1.2', 'i'], 'pnpm i', '/repo')
    expect(runCommandMock).toHaveBeenNthCalledWith(
      2,
      'corepack',
      ['pnpm@11.1.2', 'exec', 'cap', 'update', 'android'],
      'pnpm exec cap update android',
      join('/repo', 'apps/main-app'),
    )
  })

  it('fails with a clear message when pnpm and Corepack are unavailable', async () => {
    commandExistsMock.mockResolvedValue(false)
    const {installDependencies} = await import('../install-dependencies')

    await expect(installDependencies('/repo')).rejects.toThrow(
      '이 템플릿은 pnpm이 필요합니다. pnpm을 설치하거나 Corepack을 활성화해주세요.',
    )

    expect(commandExistsMock).toHaveBeenNthCalledWith(1, 'pnpm')
    expect(commandExistsMock).toHaveBeenNthCalledWith(2, 'corepack')
    expect(runCommandMock).not.toHaveBeenCalled()
  })

  it('fails when PATH pnpm is too old and Corepack is unavailable', async () => {
    commandExistsMock.mockImplementation(async (command: string) => command === 'pnpm')
    runCommandQuietlyMock.mockResolvedValue({stdout: '7.29.1'})
    const {installDependencies} = await import('../install-dependencies')

    await expect(installDependencies('/repo')).rejects.toThrow(
      '이 템플릿은 pnpm이 필요합니다. pnpm을 설치하거나 Corepack을 활성화해주세요.',
    )
  })
})
