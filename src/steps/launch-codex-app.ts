import {confirm, isCancel, log} from '@clack/prompts'
import chalk from 'chalk'
import {commandExists} from '../utils/command-exists'
import {runCommand, runCommandInBackground} from '../utils/run-command'
import type {SetupResult} from './setup-tool'

/** Codex CLI와 앱이 모두 준비되었을 때 표시할 완료 메시지입니다. */
export const CODEX_READY_WITH_APP_MESSAGE = 'Codex CLI 및 Codex 앱 사용 가능'
const DEV_SERVER_URL = 'http://localhost:3000'

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

  if (!(await commandExists('codex'))) {
    return false
  }

  if (dependenciesInstalled) {
    const shouldRunDev = await confirm({
      message: '만든 앱을 바로 확인할 수 있게 실행해둘까요? (pnpm run dev)',
      initialValue: true,
    })

    if (!isCancel(shouldRunDev) && shouldRunDev) {
      runCommandInBackground('pnpm', ['run', 'dev'], 'pnpm run dev', projectDir)
      log.info(`앱이 준비되면 여기에서 확인할 수 있어요: ${DEV_SERVER_URL}`)
    }
  }

  const shouldLaunch = await confirm({
    message: `Codex 앱을 ${projectDir}에서 열까요?`,
    initialValue: true,
  })

  if (isCancel(shouldLaunch) || !shouldLaunch) {
    return false
  }

  log.step(chalk.bold('Codex 앱 실행'))
  await runCommand('codex', ['app', projectDir], `codex app ${projectDir}`)
  return true
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
