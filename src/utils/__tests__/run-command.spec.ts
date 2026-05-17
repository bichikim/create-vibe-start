import {beforeEach, describe, expect, it, vi} from 'vitest'

const execaMock = vi.fn()
const logInfoMock = vi.fn()

vi.mock('execa', () => ({
  execa: execaMock,
}))

vi.mock('@clack/prompts', () => ({
  log: {
    info: logInfoMock,
  },
}))

describe('run-command utilities', () => {
  beforeEach(() => {
    execaMock.mockResolvedValue({})
    logInfoMock.mockReset()
  })

  it('runs visible commands with inherited stdio', async () => {
    const {runCommand} = await import('../run-command')

    await runCommand('gh', ['auth', 'login'], 'gh auth login')

    expect(logInfoMock).toHaveBeenCalledWith('실행: gh auth login')
    expect(execaMock).toHaveBeenCalledWith('gh', ['auth', 'login'], {
      stdio: 'inherit',
      preferLocal: false,
    })
  })

  it('runs quiet commands with piped stdio', async () => {
    const {runCommandQuietly} = await import('../run-command')

    await runCommandQuietly('gh', ['--version'])

    expect(execaMock).toHaveBeenCalledWith('gh', ['--version'], {
      stdio: 'pipe',
      preferLocal: false,
    })
  })

  it('runs commands from a working directory when provided', async () => {
    const {runCommand} = await import('../run-command')

    await runCommand('git', ['init'], 'git init', '/repo')

    expect(execaMock).toHaveBeenCalledWith('git', ['init'], {
      stdio: 'inherit',
      preferLocal: false,
      cwd: '/repo',
    })
  })
})
