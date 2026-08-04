import {confirm, isCancel, log, note, password, select, text} from '@clack/prompts'
import {runCommand, runCommandQuietly} from '../utils/run-command'
import {registerCodemagicApplication, startCodemagicBuild, verifyCodemagicApplication} from './codemagic-api'
import {type ProjectSetupConfig, readProjectSetupConfig, writeProjectSetupConfig} from './project-setup-config'

type MobilePlatform = 'android' | 'ios'
type MobileSelection = MobilePlatform | 'both'
type BuildSelection = MobileSelection | 'later'

const APP_ID_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/u

export async function setupMobileDeployment(projectDir: string) {
  const selection = await selectMobilePlatforms()
  const platforms = selectedPlatforms(selection)
  let config = await readProjectSetupConfig(projectDir)

  for (const platform of platforms) {
    // 먼저 저장한 플랫폼 ID를 다음 설정과 Codemagic 연결에서 재사용하므로 순서대로 실행한다.
    // eslint-disable-next-line no-await-in-loop
    config = await setupNativePlatform(projectDir, platform, config)
  }

  const shouldConfigureCodemagic = await confirm({
    message: 'Codemagic 연결과 스토어 배포 준비를 계속할까요?',
    initialValue: true,
  })
  if (!isCancel(shouldConfigureCodemagic) && shouldConfigureCodemagic) {
    await configureCodemagic(projectDir, platforms, config, true)
  }
}

export async function runCodemagicBuild(projectDir: string) {
  const config = await readProjectSetupConfig(projectDir)
  const platforms = configuredPlatforms(config)
  if (platforms.length === 0) {
    throw new Error('모바일 App ID가 설정되지 않았습니다. 먼저 모바일 배포 준비를 실행해주세요.')
  }
  await configureCodemagic(projectDir, platforms, config, false)
}

async function selectMobilePlatforms(): Promise<MobileSelection> {
  const answer = await select({
    message: '준비할 모바일 플랫폼을 선택해주세요.',
    options: [
      {label: 'iOS와 Android', value: 'both'},
      {label: 'iOS', value: 'ios'},
      {label: 'Android', value: 'android'},
    ],
  })
  if (isCancel(answer)) {
    throw new Error('모바일 배포 설정을 취소했습니다.')
  }
  return answer
}

function selectedPlatforms(selection: MobileSelection): ReadonlyArray<MobilePlatform> {
  return selection === 'both' ? ['ios', 'android'] : [selection]
}

function configuredPlatforms(config: ProjectSetupConfig): ReadonlyArray<MobilePlatform> {
  return [
    ...(config.mobile?.iosBundleId ? (['ios'] as const) : []),
    ...(config.mobile?.androidPackageName ? (['android'] as const) : []),
  ]
}

async function setupNativePlatform(
  projectDir: string,
  platform: MobilePlatform,
  config: ProjectSetupConfig,
): Promise<ProjectSetupConfig> {
  const isIos = platform === 'ios'
  const mode = await select({
    message: `${isIos ? 'iOS' : 'Android'} 앱을 어떻게 설정할까요?`,
    options: [
      {label: '새 앱으로 설정', value: 'new'},
      {label: '기존 앱 연결', value: 'existing'},
    ],
  })
  if (isCancel(mode)) {
    throw new Error('모바일 앱 설정을 취소했습니다.')
  }

  note(isIos ? iosChecklist(mode) : androidChecklist(mode), `${isIos ? 'iOS' : 'Android'} 준비 사항`)
  const currentId = isIos ? config.mobile?.iosBundleId : config.mobile?.androidPackageName
  const appId = await text({
    message: isIos ? 'Apple Bundle ID를 입력해주세요.' : 'Android Package Name을 입력해주세요.',
    placeholder: 'com.example.myapp',
    initialValue: currentId,
    validate(value) {
      return APP_ID_PATTERN.test(value.trim()) ? undefined : '소문자 reverse-domain 형식으로 입력해주세요.'
    },
  })
  if (isCancel(appId)) {
    throw new Error('모바일 App ID 설정을 취소했습니다.')
  }

  const normalizedAppId = appId.trim()
  // 네이티브 파일 갱신이 성공한 뒤에만 설정 파일에 기록해 두 상태가 어긋나지 않게 한다.
  await runCommand(
    'pnpm',
    ['run', 'app-id', platform, normalizedAppId],
    `pnpm run app-id ${platform} ${normalizedAppId}`,
    projectDir,
  )
  const nextConfig: ProjectSetupConfig = {
    ...config,
    mobile: {
      ...config.mobile,
      ...(isIos ? {iosBundleId: normalizedAppId} : {androidPackageName: normalizedAppId}),
    },
  }
  await writeProjectSetupConfig(projectDir, nextConfig)
  return nextConfig
}

function iosChecklist(mode: 'new' | 'existing') {
  const firstStep =
    mode === 'new'
      ? 'Apple Developer Program 가입 후 Explicit App ID와 앱을 생성하세요.'
      : '기존 앱의 Bundle ID를 확인하세요.'
  return [
    firstStep,
    'App ID: https://developer.apple.com/account/resources/identifiers/list',
    'App Store Connect 앱: https://appstoreconnect.apple.com/apps',
    'Codemagic에 app_store_connect 이름으로 App Store Connect 연동을 만드세요.',
  ].join('\n')
}

function androidChecklist(mode: 'new' | 'existing') {
  const firstStep =
    mode === 'new' ? 'Play Console 개발자 계정 인증 후 앱을 생성하세요.' : '기존 앱의 Package Name을 확인하세요.'
  return [
    firstStep,
    'Play Console: https://play.google.com/console',
    'Codemagic에 android_keystore 서명 항목을 추가하세요.',
    'google_play 그룹에 GOOGLE_PLAY_SERVICE_ACCOUNT_CREDENTIALS를 Secret으로 추가하세요.',
    'Google Play의 첫 앱 버전은 수동 업로드가 필요할 수 있습니다.',
  ].join('\n')
}

async function configureCodemagic(
  projectDir: string,
  platforms: ReadonlyArray<MobilePlatform>,
  config: ProjectSetupConfig,
  offerBuild: boolean,
) {
  note(
    [
      'Codemagic 계정과 GitHub 저장소를 연결하세요: https://codemagic.io/apps',
      'Account settings에서 API token을 발급하세요: https://codemagic.io/user/settings',
      'mobile 그룹에 VITE_API_URL을 등록하세요.',
      '비밀값은 저장소에 커밋하지 마세요.',
    ].join('\n'),
    'Codemagic 연결',
  )

  const token = await readCodemagicToken()
  const applicationId = await resolveCodemagicApplication(projectDir, token, config.codemagic?.applicationId)
  const nextConfig: ProjectSetupConfig = {...config, codemagic: {applicationId}}
  await writeProjectSetupConfig(projectDir, nextConfig)

  const credentialsReady = await confirm({
    message: 'Codemagic의 서명·스토어 인증 정보 설정을 완료했나요?',
    initialValue: false,
  })
  if (isCancel(credentialsReady) || !credentialsReady) {
    log.info(`나중에 설정을 마친 뒤 다시 실행하세요: https://codemagic.io/app/${applicationId}/settings`)
    return
  }

  if (offerBuild) {
    const shouldBuild = await confirm({message: '지금 Codemagic 빌드를 시작할까요?', initialValue: true})
    if (isCancel(shouldBuild) || !shouldBuild) {
      log.info(`Codemagic 대시보드에서 직접 실행할 수 있습니다: https://codemagic.io/app/${applicationId}`)
      return
    }
  }

  await selectAndStartBuild(projectDir, applicationId, token, platforms)
}

async function readCodemagicToken() {
  const environmentToken = process.env.CODEMAGIC_API_TOKEN?.trim()
  if (environmentToken) {
    // CI와 반복 실행에서는 환경변수를 우선 사용하되 파일에는 기록하지 않는다.
    return environmentToken
  }

  const answer = await password({
    message: 'Codemagic API token을 입력해주세요. 값은 저장되지 않습니다.',
    mask: '*',
    validate(value) {
      return value.trim() ? undefined : 'API token을 입력해주세요.'
    },
  })
  if (isCancel(answer)) {
    throw new Error('Codemagic 연결을 취소했습니다.')
  }
  return answer.trim()
}

async function resolveCodemagicApplication(projectDir: string, token: string, configuredId: string | undefined) {
  if (configuredId) {
    await verifyCodemagicApplication(configuredId, token)
    return configuredId
  }

  const repositoryUrl = await readRemoteUrl(projectDir)
  if (repositoryUrl) {
    try {
      // Git remote가 있으면 Codemagic 앱 등록을 먼저 시도하고, 실패할 때만 수동 ID 입력으로 전환한다.
      const application = await registerCodemagicApplication(repositoryUrl, token)
      log.success(`Codemagic 저장소 등록 완료: ${application.id}`)
      return application.id
    } catch (error) {
      log.warn(`Codemagic 자동 등록 실패: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const applicationId = await text({
    message: 'Codemagic Application ID를 입력해주세요.',
    placeholder: 'Codemagic 앱 설정 URL의 /app/<ID>/settings 부분',
    validate(value) {
      return value.trim() ? undefined : 'Application ID를 입력해주세요.'
    },
  })
  if (isCancel(applicationId)) {
    throw new Error('Codemagic 연결을 취소했습니다.')
  }
  const normalizedId = applicationId.trim()
  await verifyCodemagicApplication(normalizedId, token)
  return normalizedId
}

async function readRemoteUrl(projectDir: string) {
  try {
    return (await runCommandQuietly('git', ['remote', 'get-url', 'origin'], projectDir)).stdout.trim()
  } catch {
    return ''
  }
}

async function selectAndStartBuild(
  projectDir: string,
  applicationId: string,
  token: string,
  platforms: ReadonlyArray<MobilePlatform>,
) {
  const selection = await selectBuild(platforms)
  if (selection === 'later') {
    log.info(`Codemagic 대시보드에서 직접 실행할 수 있습니다: https://codemagic.io/app/${applicationId}`)
    return
  }

  const branch = (await runCommandQuietly('git', ['branch', '--show-current'], projectDir)).stdout.trim()
  if (!branch) {
    throw new Error('Codemagic 빌드에 사용할 현재 Git branch를 찾을 수 없습니다.')
  }

  for (const platform of selectedPlatforms(selection)) {
    const workflowId = platform === 'ios' ? 'ios-release' : 'android-release'
    // Codemagic API는 workflow별로 빌드를 시작하므로 선택한 플랫폼을 각각 요청한다.
    // eslint-disable-next-line no-await-in-loop
    const buildId = await startCodemagicBuild({applicationId, branch, token, workflowId})
    log.success(
      `${platform === 'ios' ? 'iOS' : 'Android'} 빌드 시작: https://codemagic.io/app/${applicationId}/build/${buildId}`,
    )
  }
}

async function selectBuild(platforms: ReadonlyArray<MobilePlatform>): Promise<BuildSelection> {
  const hasBoth = platforms.includes('ios') && platforms.includes('android')
  const answer = await select({
    message: '실행할 Codemagic 워크플로를 선택해주세요.',
    options: [
      ...(hasBoth ? [{label: 'iOS와 Android', value: 'both' as const}] : []),
      ...(platforms.includes('ios') ? [{label: 'iOS', value: 'ios' as const}] : []),
      ...(platforms.includes('android') ? [{label: 'Android', value: 'android' as const}] : []),
      {label: '나중에 직접 실행', value: 'later' as const},
    ],
  })
  if (isCancel(answer)) {
    return 'later'
  }
  return answer
}
