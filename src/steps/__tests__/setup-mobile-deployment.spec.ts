import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const confirmMock = vi.fn()
const noteMock = vi.fn()
const passwordMock = vi.fn()
const selectMock = vi.fn()
const textMock = vi.fn()
const logInfoMock = vi.fn()
const logSuccessMock = vi.fn()
const logWarnMock = vi.fn()
const runCommandMock = vi.fn()
const runCommandQuietlyMock = vi.fn()
const registerApplicationMock = vi.fn()
const startBuildMock = vi.fn()
const verifyApplicationMock = vi.fn()
const readConfigMock = vi.fn()
const writeConfigMock = vi.fn()
const cancel = Symbol('cancel')

vi.mock('@clack/prompts', () => ({
  confirm: confirmMock,
  note: noteMock,
  password: passwordMock,
  select: selectMock,
  text: textMock,
  isCancel: (value: unknown) => value === cancel,
  log: {info: logInfoMock, success: logSuccessMock, warn: logWarnMock},
}))

vi.mock('../../utils/run-command', () => ({
  runCommand: runCommandMock,
  runCommandQuietly: runCommandQuietlyMock,
}))

vi.mock('../codemagic-api', () => ({
  registerCodemagicApplication: registerApplicationMock,
  startCodemagicBuild: startBuildMock,
  verifyCodemagicApplication: verifyApplicationMock,
}))

vi.mock('../project-setup-config', () => ({
  readProjectSetupConfig: readConfigMock,
  writeProjectSetupConfig: writeConfigMock,
}))

describe('setup-mobile-deployment', () => {
  beforeEach(() => {
    confirmMock.mockReset()
    noteMock.mockReset()
    passwordMock.mockReset().mockResolvedValue('prompt-token')
    selectMock.mockReset()
    textMock.mockReset()
    logInfoMock.mockReset()
    logSuccessMock.mockReset()
    logWarnMock.mockReset()
    runCommandMock.mockReset().mockResolvedValue(undefined)
    runCommandQuietlyMock
      .mockReset()
      .mockImplementation((_command: string, args: string[]) =>
        Promise.resolve({stdout: args[0] === 'remote' ? 'git@github.com:owner/repo.git\n' : 'main\n'}),
      )
    registerApplicationMock.mockReset().mockResolvedValue({id: 'new-app-id'})
    startBuildMock.mockReset().mockResolvedValue('build-id')
    verifyApplicationMock.mockReset().mockResolvedValue(undefined)
    readConfigMock.mockReset().mockResolvedValue({schemaVersion: 1})
    writeConfigMock.mockReset().mockResolvedValue(undefined)
    vi.stubEnv('CODEMAGIC_API_TOKEN', 'env-token')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('configures new iOS and existing Android identifiers', async () => {
    selectMock.mockResolvedValueOnce('both').mockResolvedValueOnce('new').mockResolvedValueOnce('existing')
    textMock.mockResolvedValueOnce(' com.example.ios ').mockResolvedValueOnce('com.example.android')
    confirmMock.mockResolvedValue(false)
    const {setupMobileDeployment} = await import('../setup-mobile-deployment')

    await setupMobileDeployment('/repo')

    expect(runCommandMock).toHaveBeenNthCalledWith(
      1,
      'pnpm',
      ['run', 'app-id', 'ios', 'com.example.ios'],
      'pnpm run app-id ios com.example.ios',
      '/repo',
    )
    expect(runCommandMock).toHaveBeenNthCalledWith(
      2,
      'pnpm',
      ['run', 'app-id', 'android', 'com.example.android'],
      'pnpm run app-id android com.example.android',
      '/repo',
    )
    expect(writeConfigMock).toHaveBeenLastCalledWith('/repo', {
      schemaVersion: 1,
      mobile: {iosBundleId: 'com.example.ios', androidPackageName: 'com.example.android'},
    })
    const iosPrompt = textMock.mock.calls[0][0] as {validate(value: string): string | undefined}
    expect(iosPrompt.validate('com.example.app')).toBeUndefined()
    expect(iosPrompt.validate('Bad_App')).toBe('소문자 reverse-domain 형식으로 입력해주세요.')
    expect(noteMock).toHaveBeenCalledWith(expect.stringContaining('Explicit App ID'), 'iOS 준비 사항')
    expect(noteMock).toHaveBeenCalledWith(expect.stringContaining('기존 앱의 Package Name'), 'Android 준비 사항')
  })

  it.each(['ios', 'android'] as const)('configures a single %s identifier', async (platform) => {
    selectMock.mockResolvedValueOnce(platform).mockResolvedValueOnce('existing')
    textMock.mockResolvedValue('com.example.app')
    confirmMock.mockResolvedValue(false)
    const {setupMobileDeployment} = await import('../setup-mobile-deployment')

    await setupMobileDeployment('/repo')

    expect(runCommandMock).toHaveBeenCalledWith(
      'pnpm',
      ['run', 'app-id', platform, 'com.example.app'],
      `pnpm run app-id ${platform} com.example.app`,
      '/repo',
    )
  })

  it('handles cancellation while selecting platforms', async () => {
    selectMock.mockResolvedValue(cancel)
    const {setupMobileDeployment} = await import('../setup-mobile-deployment')

    await expect(setupMobileDeployment('/repo')).rejects.toThrow('모바일 배포 설정을 취소했습니다.')
  })

  it('handles cancellation while selecting app mode', async () => {
    selectMock.mockResolvedValueOnce('ios').mockResolvedValueOnce(cancel)
    const {setupMobileDeployment} = await import('../setup-mobile-deployment')

    await expect(setupMobileDeployment('/repo')).rejects.toThrow('모바일 앱 설정을 취소했습니다.')
  })

  it('handles cancellation while entering an app id', async () => {
    selectMock.mockResolvedValueOnce('android').mockResolvedValueOnce('new')
    textMock.mockResolvedValue(cancel)
    const {setupMobileDeployment} = await import('../setup-mobile-deployment')

    await expect(setupMobileDeployment('/repo')).rejects.toThrow('모바일 App ID 설정을 취소했습니다.')
  })

  it.each([false, cancel])('stops when Codemagic setup is declined', async (answer) => {
    selectMock.mockResolvedValueOnce('ios').mockResolvedValueOnce('new')
    textMock.mockResolvedValue('com.example.app')
    confirmMock.mockResolvedValue(answer)
    const {setupMobileDeployment} = await import('../setup-mobile-deployment')

    await setupMobileDeployment('/repo')

    expect(registerApplicationMock).not.toHaveBeenCalled()
  })

  it.each([false, cancel])('keeps Codemagic settings for later when credentials are not ready', async (answer) => {
    selectMock.mockResolvedValueOnce('ios').mockResolvedValueOnce('new')
    textMock.mockResolvedValue('com.example.app')
    confirmMock.mockResolvedValueOnce(true).mockResolvedValueOnce(answer)
    const {setupMobileDeployment} = await import('../setup-mobile-deployment')

    await setupMobileDeployment('/repo')

    expect(registerApplicationMock).toHaveBeenCalledWith('git@github.com:owner/repo.git', 'env-token')
    expect(logInfoMock).toHaveBeenCalledWith(
      '나중에 설정을 마친 뒤 다시 실행하세요: https://codemagic.io/app/new-app-id/settings',
    )
  })

  it.each([false, cancel])('supports a manual dashboard build', async (answer) => {
    selectMock.mockResolvedValueOnce('android').mockResolvedValueOnce('new')
    textMock.mockResolvedValue('com.example.app')
    confirmMock.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(answer)
    const {setupMobileDeployment} = await import('../setup-mobile-deployment')

    await setupMobileDeployment('/repo')

    expect(logInfoMock).toHaveBeenCalledWith(
      'Codemagic 대시보드에서 직접 실행할 수 있습니다: https://codemagic.io/app/new-app-id',
    )
  })

  it('can continue from mobile setup into a direct build', async () => {
    selectMock.mockResolvedValueOnce('ios').mockResolvedValueOnce('new').mockResolvedValueOnce('later')
    textMock.mockResolvedValue('com.example.app')
    confirmMock.mockResolvedValue(true)
    const {setupMobileDeployment} = await import('../setup-mobile-deployment')

    await setupMobileDeployment('/repo')

    expect(logInfoMock).toHaveBeenCalledWith(
      'Codemagic 대시보드에서 직접 실행할 수 있습니다: https://codemagic.io/app/new-app-id',
    )
  })

  it('starts both configured workflows with a prompted token', async () => {
    vi.stubEnv('CODEMAGIC_API_TOKEN', '')
    readConfigMock.mockResolvedValue({
      schemaVersion: 1,
      mobile: {iosBundleId: 'com.example.ios', androidPackageName: 'com.example.android'},
      codemagic: {applicationId: 'app-id'},
    })
    confirmMock.mockResolvedValue(true)
    selectMock.mockResolvedValue('both')
    const {runCodemagicBuild} = await import('../setup-mobile-deployment')

    await runCodemagicBuild('/repo')

    const tokenPrompt = passwordMock.mock.calls[0][0] as {validate(value: string): string | undefined}
    expect(tokenPrompt.validate('token')).toBeUndefined()
    expect(tokenPrompt.validate(' ')).toBe('API token을 입력해주세요.')
    expect(verifyApplicationMock).toHaveBeenCalledWith('app-id', 'prompt-token')
    expect(startBuildMock).toHaveBeenNthCalledWith(1, {
      applicationId: 'app-id',
      branch: 'main',
      token: 'prompt-token',
      workflowId: 'ios-release',
    })
    expect(startBuildMock).toHaveBeenNthCalledWith(2, {
      applicationId: 'app-id',
      branch: 'main',
      token: 'prompt-token',
      workflowId: 'android-release',
    })
  })

  it('falls back to a manually entered Codemagic application id', async () => {
    registerApplicationMock.mockRejectedValue(new Error('preview API failed'))
    selectMock.mockResolvedValueOnce('ios').mockResolvedValueOnce('new')
    textMock.mockResolvedValueOnce('com.example.ios').mockResolvedValueOnce(' manual-app-id ')
    confirmMock.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const {setupMobileDeployment} = await import('../setup-mobile-deployment')

    await setupMobileDeployment('/repo')

    expect(logWarnMock).toHaveBeenCalledWith('Codemagic 자동 등록 실패: preview API failed')
    expect(verifyApplicationMock).toHaveBeenCalledWith('manual-app-id', 'env-token')
    const applicationPrompt = textMock.mock.calls[1][0] as {validate(value: string): string | undefined}
    expect(applicationPrompt.validate('app-id')).toBeUndefined()
    expect(applicationPrompt.validate(' ')).toBe('Application ID를 입력해주세요.')
  })

  it('formats unknown Codemagic registration failures', async () => {
    registerApplicationMock.mockRejectedValue('preview failure')
    selectMock.mockResolvedValueOnce('android').mockResolvedValueOnce('new')
    textMock.mockResolvedValueOnce('com.example.android').mockResolvedValueOnce('manual-app-id')
    confirmMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const {setupMobileDeployment} = await import('../setup-mobile-deployment')

    await setupMobileDeployment('/repo')

    expect(logWarnMock).toHaveBeenCalledWith('Codemagic 자동 등록 실패: preview failure')
  })

  it('falls back when a Git remote is unavailable and handles application input cancellation', async () => {
    runCommandQuietlyMock.mockRejectedValue(new Error('no remote'))
    selectMock.mockResolvedValueOnce('android').mockResolvedValueOnce('new')
    textMock.mockResolvedValueOnce('com.example.android').mockResolvedValueOnce(cancel)
    confirmMock.mockResolvedValueOnce(true)
    const {setupMobileDeployment} = await import('../setup-mobile-deployment')

    await expect(setupMobileDeployment('/repo')).rejects.toThrow('Codemagic 연결을 취소했습니다.')
  })

  it('handles Codemagic token input cancellation', async () => {
    vi.stubEnv('CODEMAGIC_API_TOKEN', '')
    readConfigMock.mockResolvedValue({schemaVersion: 1, mobile: {iosBundleId: 'com.example.ios'}})
    passwordMock.mockResolvedValue(cancel)
    const {runCodemagicBuild} = await import('../setup-mobile-deployment')

    await expect(runCodemagicBuild('/repo')).rejects.toThrow('Codemagic 연결을 취소했습니다.')
  })

  it('requires a configured mobile platform before running Codemagic', async () => {
    const {runCodemagicBuild} = await import('../setup-mobile-deployment')

    await expect(runCodemagicBuild('/repo')).rejects.toThrow(
      '모바일 App ID가 설정되지 않았습니다. 먼저 모바일 배포 준비를 실행해주세요.',
    )
  })

  it.each(['later', cancel])('allows delaying a direct Codemagic build', async (answer) => {
    readConfigMock.mockResolvedValue({
      schemaVersion: 1,
      mobile: {androidPackageName: 'com.example.android'},
      codemagic: {applicationId: 'app-id'},
    })
    confirmMock.mockResolvedValue(true)
    selectMock.mockResolvedValue(answer)
    const {runCodemagicBuild} = await import('../setup-mobile-deployment')

    await runCodemagicBuild('/repo')

    expect(startBuildMock).not.toHaveBeenCalled()
    expect(logInfoMock).toHaveBeenCalledWith(
      'Codemagic 대시보드에서 직접 실행할 수 있습니다: https://codemagic.io/app/app-id',
    )
  })

  it('requires a current Git branch before starting a build', async () => {
    readConfigMock.mockResolvedValue({
      schemaVersion: 1,
      mobile: {iosBundleId: 'com.example.ios'},
      codemagic: {applicationId: 'app-id'},
    })
    confirmMock.mockResolvedValue(true)
    selectMock.mockResolvedValue('ios')
    runCommandQuietlyMock.mockResolvedValue({stdout: ''})
    const {runCodemagicBuild} = await import('../setup-mobile-deployment')

    await expect(runCodemagicBuild('/repo')).rejects.toThrow(
      'Codemagic 빌드에 사용할 현재 Git branch를 찾을 수 없습니다.',
    )
  })
})
