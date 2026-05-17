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

  it('falls back to npm when pnpm is unavailable', async () => {
    commandExistsMock.mockResolvedValue(false)
    const {installDependencies} = await import('../install-dependencies')

    await expect(installDependencies('/repo')).resolves.toBe(true)

    expect(commandExistsMock).toHaveBeenCalledWith('pnpm')
    expect(runCommandMock).toHaveBeenCalledWith('npm', ['i'], 'npm i', '/repo')
  })
})
