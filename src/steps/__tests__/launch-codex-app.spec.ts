import {beforeEach, describe, expect, it, vi} from 'vitest'

const isCancelMock = vi.fn()
const logInfoMock = vi.fn()
const logStepMock = vi.fn()
const multiselectMock = vi.fn()
const commandExistsMock = vi.fn()
const runCommandMock = vi.fn()

vi.mock('@clack/prompts', () => ({
  isCancel: isCancelMock,
  log: {
    info: logInfoMock,
    step: logStepMock,
  },
  multiselect: multiselectMock,
}))

vi.mock('../../utils/command-exists.js', () => ({
  commandExists: commandExistsMock,
}))

vi.mock('../../utils/run-command.js', () => ({
  runCommand: runCommandMock,
}))

describe('launchCodexApp', () => {
  beforeEach(() => {
    isCancelMock.mockReset().mockReturnValue(false)
    logInfoMock.mockReset()
    logStepMock.mockReset()
    multiselectMock.mockReset().mockResolvedValue(['codex'])
    commandExistsMock.mockReset().mockResolvedValue(true)
    runCommandMock.mockReset().mockResolvedValue(undefined)
  })

  it('launches Codex app when setup is ready and the user selects it', async () => {
    const {launchCodexApp} = await import('../launch-codex-app')

    await expect(launchCodexApp('/repo', {name: 'Codex', status: 'ready', message: 'ok'})).resolves.toBe(true)

    expect(multiselectMock).toHaveBeenCalledWith({
      message: '후속 작업을 선택하세요. (Space로 선택, Enter로 완료)',
      options: [{label: 'Codex 앱 열기 (/repo)', value: 'codex'}],
      required: false,
    })
    expect(runCommandMock).toHaveBeenCalledWith('codex', ['app', '/repo'], 'codex app /repo')
  })

  it('asks for follow-up work and runs dev in the foreground after Codex app when selected', async () => {
    multiselectMock.mockResolvedValue(['codex', 'dev'])
    const {launchCodexApp} = await import('../launch-codex-app')

    await expect(launchCodexApp('/repo', {name: 'Codex', status: 'ready', message: 'ok'}, true)).resolves.toBe(true)

    expect(multiselectMock).toHaveBeenCalledWith({
      message: '후속 작업을 선택하세요. (Space로 선택, Enter로 완료)',
      options: [
        {label: 'Codex 앱 열기 (/repo)', value: 'codex'},
        {label: 'dev 로컬 개발자 미리 보기 (pnpm run dev)', value: 'dev'},
      ],
      required: false,
    })
    expect(logInfoMock).toHaveBeenCalledWith('앱이 준비되면 여기에서 확인할 수 있어요: http://localhost:3000')
    expect(runCommandMock).toHaveBeenNthCalledWith(1, 'codex', ['app', '/repo'], 'codex app /repo')
    expect(runCommandMock).toHaveBeenNthCalledWith(2, 'pnpm', ['run', 'dev'], 'pnpm run dev', '/repo')
  })

  it('runs only dev preview when only dev is selected', async () => {
    multiselectMock.mockResolvedValue(['dev'])
    const {launchCodexApp} = await import('../launch-codex-app')

    await expect(launchCodexApp('/repo', {name: 'Codex', status: 'ready', message: 'ok'}, true)).resolves.toBe(false)

    expect(runCommandMock).toHaveBeenCalledWith('pnpm', ['run', 'dev'], 'pnpm run dev', '/repo')
  })

  it('skips launch when Codex setup is not ready', async () => {
    const {launchCodexApp} = await import('../launch-codex-app')

    await expect(
      launchCodexApp('/repo', {name: 'Codex', status: 'skipped', message: 'skipped'}),
    ).resolves.toBe(false)

    expect(multiselectMock).not.toHaveBeenCalled()
    expect(runCommandMock).not.toHaveBeenCalled()
  })

  it('skips launch when codex command is missing and dev preview is unavailable', async () => {
    commandExistsMock.mockResolvedValue(false)
    const {launchCodexApp} = await import('../launch-codex-app')

    await expect(launchCodexApp('/repo', {name: 'Codex', status: 'ready', message: 'ok'})).resolves.toBe(false)

    expect(multiselectMock).not.toHaveBeenCalled()
    expect(runCommandMock).not.toHaveBeenCalled()
  })

  it('offers dev preview when codex command is missing', async () => {
    commandExistsMock.mockResolvedValue(false)
    multiselectMock.mockResolvedValue(['dev'])
    const {launchCodexApp} = await import('../launch-codex-app')

    await expect(launchCodexApp('/repo', {name: 'Codex', status: 'ready', message: 'ok'}, true)).resolves.toBe(false)

    expect(multiselectMock).toHaveBeenCalledWith({
      message: '후속 작업을 선택하세요. (Space로 선택, Enter로 완료)',
      options: [{label: 'dev 로컬 개발자 미리 보기 (pnpm run dev)', value: 'dev'}],
      required: false,
    })
    expect(runCommandMock).toHaveBeenCalledWith('pnpm', ['run', 'dev'], 'pnpm run dev', '/repo')
  })

  it('skips launch when the user selects nothing or cancels', async () => {
    multiselectMock.mockResolvedValue([])
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

  it('keeps setup results unchanged when Codex app was not launched', async () => {
    const {withCodexAppReadyMessage} = await import('../launch-codex-app')
    const results = [{name: 'Codex', status: 'ready' as const, message: 'Codex CLI 사용 가능'}]

    expect(withCodexAppReadyMessage(results, false)).toBe(results)
  })
})
