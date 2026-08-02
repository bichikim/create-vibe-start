import {beforeEach, describe, expect, it, vi} from 'vitest'

const commandExistsMock = vi.fn()
const runCommandMock = vi.fn()
const mkdirMock = vi.hoisted(() => vi.fn())
const writeFileMock = vi.hoisted(() => vi.fn())

vi.mock('../../utils/command-exists.js', () => ({
  commandExists: commandExistsMock,
}))

vi.mock('../../utils/run-command.js', () => ({
  runCommand: runCommandMock,
}))

vi.mock('node:fs/promises', () => ({
  mkdir: mkdirMock,
  writeFile: writeFileMock,
}))

describe('installDependencies', () => {
  beforeEach(() => {
    commandExistsMock.mockReset()
    runCommandMock.mockReset().mockResolvedValue(undefined)
    mkdirMock.mockReset().mockResolvedValue(undefined)
    writeFileMock.mockReset().mockResolvedValue(undefined)
  })

  it('uses pnpm when available', async () => {
    commandExistsMock.mockResolvedValue(true)
    const {installDependencies} = await import('../install-dependencies')

    await expect(installDependencies('/repo')).resolves.toBe(true)

    expect(commandExistsMock).toHaveBeenCalledWith('pnpm')
    expect(runCommandMock).toHaveBeenNthCalledWith(1, 'pnpm', ['i'], 'pnpm i', '/repo')
    expect(mkdirMock).toHaveBeenCalledWith('/repo/apps/main-app/android/app/src/main/assets', {recursive: true})
    expect(mkdirMock).toHaveBeenCalledWith('/repo/apps/main-app/dist', {recursive: true})
    expect(writeFileMock).toHaveBeenCalledWith(
      '/repo/apps/main-app/dist/index.html',
      '<!doctype html><title>vibe</title>\n',
    )
    expect(runCommandMock).toHaveBeenNthCalledWith(
      2,
      'pnpm',
      ['exec', 'cap', 'update', 'android'],
      'pnpm exec cap update android',
      '/repo/apps/main-app',
    )
  })

  it('uses Corepack to activate pnpm when pnpm is unavailable', async () => {
    commandExistsMock
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
    const {installDependencies} = await import('../install-dependencies')

    await expect(installDependencies('/repo')).resolves.toBe(true)

    expect(commandExistsMock).toHaveBeenNthCalledWith(1, 'pnpm')
    expect(commandExistsMock).toHaveBeenNthCalledWith(2, 'corepack')
    expect(commandExistsMock).toHaveBeenNthCalledWith(3, 'pnpm')
    expect(runCommandMock).toHaveBeenNthCalledWith(1, 'corepack', ['enable', 'pnpm'], 'corepack enable pnpm')
    expect(runCommandMock).toHaveBeenNthCalledWith(
      2,
      'corepack',
      ['prepare', 'pnpm@11.1.2', '--activate'],
      'corepack prepare pnpm@11.1.2 --activate',
    )
    expect(runCommandMock).toHaveBeenNthCalledWith(3, 'pnpm', ['i'], 'pnpm i', '/repo')
    expect(mkdirMock).toHaveBeenCalledWith('/repo/apps/main-app/android/app/src/main/assets', {recursive: true})
    expect(mkdirMock).toHaveBeenCalledWith('/repo/apps/main-app/dist', {recursive: true})
    expect(writeFileMock).toHaveBeenCalledWith(
      '/repo/apps/main-app/dist/index.html',
      '<!doctype html><title>vibe</title>\n',
    )
    expect(runCommandMock).toHaveBeenNthCalledWith(
      4,
      'pnpm',
      ['exec', 'cap', 'update', 'android'],
      'pnpm exec cap update android',
      '/repo/apps/main-app',
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

  it('fails when Corepack does not make the pnpm command available', async () => {
    commandExistsMock
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
    const {installDependencies} = await import('../install-dependencies')

    await expect(installDependencies('/repo')).rejects.toThrow(
      'Corepack으로 pnpm을 활성화했지만 pnpm 명령을 찾을 수 없습니다.',
    )

    expect(runCommandMock).toHaveBeenNthCalledWith(1, 'corepack', ['enable', 'pnpm'], 'corepack enable pnpm')
    expect(runCommandMock).toHaveBeenNthCalledWith(
      2,
      'corepack',
      ['prepare', 'pnpm@11.1.2', '--activate'],
      'corepack prepare pnpm@11.1.2 --activate',
    )
  })
})
