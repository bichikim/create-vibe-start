import {beforeEach, describe, expect, it, vi} from 'vitest'

const execaMock = vi.fn()
const logInfoMock = vi.fn()
const logWarnMock = vi.fn()
const subprocessOnMock = vi.fn()
const subprocessUnrefMock = vi.fn()
const spawnMock = vi.fn()

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}))

vi.mock('execa', () => ({
  execa: execaMock,
}))

vi.mock('@clack/prompts', () => ({
  log: {
    info: logInfoMock,
    warn: logWarnMock,
  },
}))

describe('run-command utilities', () => {
  beforeEach(() => {
    execaMock.mockResolvedValue({})
    logInfoMock.mockReset()
    logWarnMock.mockReset()
    subprocessOnMock.mockReset()
    subprocessUnrefMock.mockReset()
    spawnMock.mockReset().mockReturnValue({
      on: subprocessOnMock,
      unref: subprocessUnrefMock,
    })
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

  it('starts background commands detached', async () => {
    const {runCommandInBackground} = await import('../run-command')

    runCommandInBackground('pnpm', ['run', 'dev'], 'pnpm run dev', '/repo')

    expect(logInfoMock).toHaveBeenCalledWith('백그라운드 실행: pnpm run dev')
    expect(spawnMock).toHaveBeenCalledWith('pnpm', ['run', 'dev'], {
      detached: true,
      stdio: 'ignore',
      cwd: '/repo',
    })
    expect(subprocessOnMock).toHaveBeenCalledWith('error', expect.any(Function))
    expect(subprocessUnrefMock).toHaveBeenCalledOnce()
  })
})
