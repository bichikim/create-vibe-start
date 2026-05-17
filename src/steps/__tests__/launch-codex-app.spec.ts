import {beforeEach, describe, expect, it, vi} from 'vitest'

const confirmMock = vi.fn()
const isCancelMock = vi.fn()
const logInfoMock = vi.fn()
const logStepMock = vi.fn()
const commandExistsMock = vi.fn()
const runCommandMock = vi.fn()
const runCommandInBackgroundMock = vi.fn()

vi.mock('@clack/prompts', () => ({
  confirm: confirmMock,
  isCancel: isCancelMock,
  log: {
    info: logInfoMock,
    step: logStepMock,
  },
}))

vi.mock('../../utils/command-exists.js', () => ({
  commandExists: commandExistsMock,
}))

vi.mock('../../utils/run-command.js', () => ({
  runCommand: runCommandMock,
  runCommandInBackground: runCommandInBackgroundMock,
}))

describe('launchCodexApp', () => {
  beforeEach(() => {
    confirmMock.mockReset().mockResolvedValue(true)
    isCancelMock.mockReset().mockReturnValue(false)
    logInfoMock.mockReset()
    logStepMock.mockReset()
    commandExistsMock.mockReset().mockResolvedValue(true)
    runCommandMock.mockReset().mockResolvedValue(undefined)
    runCommandInBackgroundMock.mockReset()
  })

  it('launches Codex app when setup is ready and the user confirms', async () => {
    const {launchCodexApp} = await import('../launch-codex-app')

    await expect(launchCodexApp('/repo', {name: 'Codex', status: 'ready', message: 'ok'})).resolves.toBe(true)

    expect(confirmMock).toHaveBeenCalledWith({
      message: 'Codex 앱을 /repo에서 열까요?',
      initialValue: true,
    })
    expect(runCommandMock).toHaveBeenCalledWith('codex', ['app', '/repo'], 'codex app /repo')
    expect(runCommandInBackgroundMock).not.toHaveBeenCalled()
  })

  it('asks to run dev in the background before launch when dependencies were installed', async () => {
    const {launchCodexApp} = await import('../launch-codex-app')

    await expect(launchCodexApp('/repo', {name: 'Codex', status: 'ready', message: 'ok'}, true)).resolves.toBe(true)

    expect(confirmMock).toHaveBeenNthCalledWith(1, {
      message: '만든 앱을 바로 확인할 수 있게 실행해둘까요? (pnpm run dev)',
      initialValue: true,
    })
    expect(confirmMock).toHaveBeenNthCalledWith(2, {
      message: 'Codex 앱을 /repo에서 열까요?',
      initialValue: true,
    })
    expect(runCommandInBackgroundMock).toHaveBeenCalledWith('pnpm', ['run', 'dev'], 'pnpm run dev', '/repo')
    expect(logInfoMock).toHaveBeenCalledWith('앱이 준비되면 여기에서 확인할 수 있어요: http://localhost:3000')
    expect(runCommandMock).toHaveBeenCalledWith('codex', ['app', '/repo'], 'codex app /repo')
  })

  it('does not run dev when the user declines', async () => {
    confirmMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const {launchCodexApp} = await import('../launch-codex-app')

    await expect(launchCodexApp('/repo', {name: 'Codex', status: 'ready', message: 'ok'}, true)).resolves.toBe(true)

    expect(runCommandInBackgroundMock).not.toHaveBeenCalled()
    expect(runCommandMock).toHaveBeenCalledWith('codex', ['app', '/repo'], 'codex app /repo')
  })

  it('skips launch when Codex setup is not ready', async () => {
    const {launchCodexApp} = await import('../launch-codex-app')

    await expect(
      launchCodexApp('/repo', {name: 'Codex', status: 'skipped', message: 'skipped'}),
    ).resolves.toBe(false)

    expect(confirmMock).not.toHaveBeenCalled()
    expect(runCommandMock).not.toHaveBeenCalled()
  })

  it('skips launch when codex command is missing', async () => {
    commandExistsMock.mockResolvedValue(false)
    const {launchCodexApp} = await import('../launch-codex-app')

    await expect(launchCodexApp('/repo', {name: 'Codex', status: 'ready', message: 'ok'})).resolves.toBe(false)

    expect(confirmMock).not.toHaveBeenCalled()
    expect(runCommandMock).not.toHaveBeenCalled()
  })

  it('skips launch when the user declines or cancels', async () => {
    confirmMock.mockResolvedValue(false)
    const {launchCodexApp} = await import('../launch-codex-app')

    await expect(launchCodexApp('/repo', {name: 'Codex', status: 'ready', message: 'ok'})).resolves.toBe(false)

    expect(runCommandMock).not.toHaveBeenCalled()
  })

  it('updates the Codex ready message after app launch', async () => {
    const {withCodexAppReadyMessage, CODEX_READY_WITH_APP_MESSAGE} = await import('../launch-codex-app')

    expect(
      withCodexAppReadyMessage(
        [
          {name: 'GitHub', status: 'ready', message: 'GitHub CLI 사용 가능'},
          {name: 'Codex', status: 'ready', message: 'Codex CLI 사용 가능'},
        ],
        true,
      ),
    ).toEqual([
      {name: 'GitHub', status: 'ready', message: 'GitHub CLI 사용 가능'},
      {name: 'Codex', status: 'ready', message: CODEX_READY_WITH_APP_MESSAGE},
    ])
  })
})
