import {beforeEach, describe, expect, it, vi} from 'vitest'

const commandExistsMock = vi.fn()
const runCommandMock = vi.fn()

vi.mock('../../utils/command-exists.js', () => ({
  commandExists: commandExistsMock,
}))

vi.mock('../../utils/run-command.js', () => ({
  runCommand: runCommandMock,
}))

describe('installDependencies', () => {
  beforeEach(() => {
    commandExistsMock.mockReset()
    runCommandMock.mockReset().mockResolvedValue(undefined)
  })

  it('uses pnpm when available', async () => {
    commandExistsMock.mockResolvedValue(true)
    const {installDependencies} = await import('../install-dependencies')

    await expect(installDependencies('/repo')).resolves.toBe(true)

    expect(commandExistsMock).toHaveBeenCalledWith('pnpm')
    expect(runCommandMock).toHaveBeenCalledWith('pnpm', ['i'], 'pnpm i', '/repo')
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
