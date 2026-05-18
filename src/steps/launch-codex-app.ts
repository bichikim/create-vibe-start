import {isCancel, log, multiselect} from '@clack/prompts'
import chalk from 'chalk'
import {commandExists} from '../utils/command-exists'
import {runCommand} from '../utils/run-command'
import type {SetupResult} from './setup-tool'

/** Codex CLI와 앱이 모두 준비되었을 때 표시할 완료 메시지입니다. */
export const CODEX_READY_WITH_APP_MESSAGE = 'Codex CLI 및 Codex 앱 사용 가능'
const DEV_SERVER_URL = 'http://localhost:3000'
type FollowUpAction = 'codex' | 'dev'

/**
 * Codex CLI가 준비된 경우 데스크톱 앱을 프로젝트 폴더에서 실행합니다.
 *
 * @param projectDir - Codex 앱에서 열 워크스페이스 경로입니다.
 * @param codexResult - Codex CLI 준비 단계 결과입니다.
 * @param dependenciesInstalled - 이번 실행에서 프로젝트 의존성 설치를 완료했는지 여부입니다.
 * @returns 앱 실행을 완료했으면 `true`, 건너뛰거나 거절했으면 `false`입니다.
 */
export async function launchCodexApp(
  projectDir: string,
  codexResult: SetupResult | undefined,
  dependenciesInstalled = false,
): Promise<boolean> {
  if (codexResult?.status !== 'ready') {
    return false
  }

  const canLaunchCodex = await commandExists('codex')
  const options: {label: string; value: FollowUpAction}[] = [
    ...(canLaunchCodex ? [{label: `Codex 앱 열기 (${projectDir})`, value: 'codex' as const}] : []),
    ...(dependenciesInstalled ? [{label: 'dev 로컬 개발자 미리 보기 (pnpm run dev)', value: 'dev' as const}] : []),
  ]

  if (options.length === 0) {
    return false
  }

  const followUpActions = await multiselect<FollowUpAction>({
    message: '후속 작업을 선택하세요. (Space로 선택, Enter로 완료)',
    options,
    required: false,
  })

  if (isCancel(followUpActions) || followUpActions.length === 0) {
    return false
  }

  const shouldLaunchCodex = followUpActions.includes('codex')
  const shouldRunDev = followUpActions.includes('dev')

  if (shouldLaunchCodex) {
    log.step(chalk.bold('Codex 앱 실행'))
    await runCommand('codex', ['app', projectDir], `codex app ${projectDir}`)
  }

  if (shouldRunDev) {
    log.info(`앱이 준비되면 여기에서 확인할 수 있어요: ${DEV_SERVER_URL}`)
    await runCommand('pnpm', ['run', 'dev'], 'pnpm run dev', projectDir)
  }

  return shouldLaunchCodex
}

/**
 * Codex 앱 실행이 완료된 경우 준비 결과의 Codex 메시지를 갱신합니다.
 *
 * @param results - 준비 단계 결과 목록입니다.
 * @param launched - Codex 앱 실행을 완료했는지 여부입니다.
 * @returns 갱신된 준비 단계 결과 목록입니다.
 */
export function withCodexAppReadyMessage(results: SetupResult[], launched: boolean): SetupResult[] {
  if (!launched) {
    return results
  }

  return results.map((result) =>
    (result.name === 'Codex' && result.status === 'ready'
      ? {...result, message: CODEX_READY_WITH_APP_MESSAGE}
      : result),
  )
}
