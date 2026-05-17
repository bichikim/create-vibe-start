import {beforeEach, describe, expect, it, vi} from 'vitest'

const confirmMock = vi.fn()
const isCancelMock = vi.fn()
const logStepMock = vi.fn()
const commandExistsMock = vi.fn()
const runCommandMock = vi.fn()

vi.mock('@clack/prompts', () => ({
  confirm: confirmMock,
  isCancel: isCancelMock,
  log: {
    step: logStepMock,
  },
}))

vi.mock('../../utils/command-exists.js', () => ({
  commandExists: commandExistsMock,
}))

vi.mock('../../utils/run-command.js', () => ({
  runCommand: runCommandMock,
}))

describe('launchCodexApp', () => {
  beforeEach(() => {
    confirmMock.mockReset().mockResolvedValue(true)
    isCancelMock.mockReset().mockReturnValue(false)
    logStepMock.mockReset()
    commandExistsMock.mockReset().mockResolvedValue(true)
    runCommandMock.mockReset().mockResolvedValue(undefined)
  })

  it('launches Codex app when setup is ready and the user confirms', async () => {
    const {launchCodexApp} = await import('../launch-codex-app')

    await expect(launchCodexApp('/repo', {name: 'Codex', status: 'ready', message: 'ok'})).resolves.toBe(true)

    expect(confirmMock).toHaveBeenCalledWith({
      message: 'Codex 앱을 /repo에서 열까요?',
      initialValue: true,
    })
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
