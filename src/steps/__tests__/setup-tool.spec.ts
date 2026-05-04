import {beforeEach, describe, expect, it, vi} from 'vitest'

const commandExistsMock = vi.fn()
const detectPlatformMock = vi.fn()
const runCommandMock = vi.fn()
const runCommandQuietlyMock = vi.fn()
const confirmMock = vi.fn()
const selectMock = vi.fn()
const logStepMock = vi.fn()
const logWarnMock = vi.fn()
const logErrorMock = vi.fn()
const spinnerStartMock = vi.fn()
const spinnerStopMock = vi.fn()

vi.mock('../../utils/command-exists.js', () => ({
  commandExists: commandExistsMock,
}))

vi.mock('../../utils/detect-platform.js', () => ({
  detectPlatform: detectPlatformMock,
}))

vi.mock('../../utils/run-command.js', () => ({
  runCommand: runCommandMock,
  runCommandQuietly: runCommandQuietlyMock,
}))

vi.mock('@clack/prompts', () => ({
  confirm: confirmMock,
  select: selectMock,
  isCancel: (value: unknown) => value === 'cancel',
  log: {
    step: logStepMock,
    warn: logWarnMock,
    error: logErrorMock,
  },
  spinner: () => ({
    start: spinnerStartMock,
    stop: spinnerStopMock,
  }),
}))

const options = {
  name: 'Example',
  command: 'example',
  versionArgs: ['--version'],
  authCheckArgs: ['auth', 'status'],
  loginArgs: ['auth', 'login'],
  install: {
    macos: {
      command: 'brew',
      args: ['install', 'example'],
      label: 'brew install example',
    },
    linux: {
      command: 'example',
      args: [],
      label: 'manual install docs',
    },
    windows: {
      command: 'winget',
      args: ['install', 'Example.CLI'],
      label: 'winget install Example.CLI',
    },
  },
}

describe('setupTool', () => {
  beforeEach(() => {
    commandExistsMock.mockReset()
    detectPlatformMock.mockReset().mockReturnValue('macos')
    runCommandMock.mockReset().mockResolvedValue(undefined)
    runCommandQuietlyMock.mockReset().mockResolvedValue(undefined)
    confirmMock.mockReset()
    selectMock.mockReset()
    logStepMock.mockReset()
    logWarnMock.mockReset()
    logErrorMock.mockReset()
    spinnerStartMock.mockReset()
    spinnerStopMock.mockReset()
  })

  it('returns ready when the command exists and auth check passes', async () => {
    commandExistsMock.mockResolvedValue(true)
    const {setupTool} = await import('../setup-tool.js')

    await expect(setupTool(options)).resolves.toEqual({
      name: 'Example',
      status: 'ready',
      message: 'Example CLI 사용 가능',
    })

    expect(runCommandQuietlyMock).toHaveBeenNthCalledWith(1, 'example', ['--version'])
    expect(runCommandQuietlyMock).toHaveBeenNthCalledWith(2, 'example', ['auth', 'status'])
    expect(confirmMock).not.toHaveBeenCalled()
  })

  it('uses the command label for the successful check message when provided', async () => {
    commandExistsMock.mockResolvedValue(true)
    const {setupTool} = await import('../setup-tool.js')

    await setupTool({...options, commandLabel: 'example cli'})

    expect(spinnerStopMock).toHaveBeenCalledWith('example cli 확인 완료')
  })

  it('skips when the command is missing and the user skips installation', async () => {
    commandExistsMock.mockResolvedValue(false)
    selectMock.mockResolvedValue('skip')
    const {setupTool} = await import('../setup-tool.js')

    await expect(setupTool(options)).resolves.toEqual({
      name: 'Example',
      status: 'skipped',
      message: 'Example CLI 설치를 건너뜀',
    })
  })

  it('installs, logs in, and returns ready', async () => {
    commandExistsMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    selectMock.mockResolvedValue('install')
    runCommandQuietlyMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('not logged in'))
      .mockResolvedValueOnce(undefined)
    confirmMock.mockResolvedValue(true)
    const {setupTool} = await import('../setup-tool.js')

    await expect(setupTool(options)).resolves.toEqual({
      name: 'Example',
      status: 'ready',
      message: 'Example 로그인 완료',
    })

    expect(runCommandMock).toHaveBeenNthCalledWith(1, 'brew', ['install', 'example'], 'brew install example')
    expect(runCommandMock).toHaveBeenNthCalledWith(2, 'example', ['auth', 'login'], 'example auth login')
  })

  it('fails when installation finishes but the command is still missing', async () => {
    commandExistsMock.mockResolvedValue(false)
    selectMock.mockResolvedValue('install')
    const {setupTool} = await import('../setup-tool.js')

    await expect(setupTool(options)).resolves.toEqual({
      name: 'Example',
      status: 'failed',
      message: 'example 설치 후에도 명령을 찾을 수 없음',
    })
  })

  it('skips with a warning when only manual installation guidance is available', async () => {
    commandExistsMock.mockResolvedValue(false)
    detectPlatformMock.mockReturnValue('linux')
    const {setupTool} = await import('../setup-tool.js')

    await expect(setupTool(options)).resolves.toMatchObject({
      status: 'skipped',
      message: 'Example CLI 설치를 건너뜀',
    })
    expect(logWarnMock).toHaveBeenCalledWith('Example CLI 설치가 필요합니다: manual install docs')
  })

  it('skips login when the user declines after auth check fails', async () => {
    commandExistsMock.mockResolvedValue(true)
    runCommandQuietlyMock.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('not logged in'))
    confirmMock.mockResolvedValue(false)
    const {setupTool} = await import('../setup-tool.js')

    await expect(setupTool(options)).resolves.toEqual({
      name: 'Example',
      status: 'skipped',
      message: 'Example 로그인을 건너뜀',
    })
    expect(runCommandMock).not.toHaveBeenCalled()
  })

  it('returns failed when login completes but auth check still fails', async () => {
    commandExistsMock.mockResolvedValue(true)
    runCommandQuietlyMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('not logged in'))
      .mockRejectedValueOnce(new Error('still not logged in'))
    confirmMock.mockResolvedValue(true)
    const {setupTool} = await import('../setup-tool.js')

    await expect(setupTool(options)).resolves.toEqual({
      name: 'Example',
      status: 'failed',
      message: 'Example 로그인 상태 확인 실패',
    })
  })

  it('skips installation when the install prompt is cancelled', async () => {
    commandExistsMock.mockResolvedValue(false)
    selectMock.mockResolvedValue('cancel')
    const {setupTool} = await import('../setup-tool.js')

    await expect(setupTool(options)).resolves.toMatchObject({
      status: 'skipped',
    })
  })
})
