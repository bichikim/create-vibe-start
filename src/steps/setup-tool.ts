import {confirm, isCancel, log, select, spinner} from '@clack/prompts'
import chalk from 'chalk'
import {commandExists} from '../utils/command-exists'
import {detectPlatform} from '../utils/detect-platform'
import {runCommand, runCommandQuietly} from '../utils/run-command'

/** 특정 운영체제에서 CLI를 설치하기 위해 실행할 명령입니다. */
type PlatformCommand = {
  command: string
  args: string[]
  label: string
}

/** 공통 CLI 준비 흐름에 필요한 도구별 설정입니다. */
type SetupToolOptions = {
  name: string
  command: string
  commandLabel?: string
  versionArgs: string[]
  authCheckArgs?: string[]
  loginArgs?: string[]
  loginLabel?: string
  install: Record<'macos' | 'linux' | 'windows', PlatformCommand>
}

/** CLI 준비 단계가 사용자에게 보고할 최종 상태입니다. */
export type SetupResult = {
  name: string
  status: 'ready' | 'skipped' | 'failed'
  message: string
}

/** 단일 CLI 준비 작업을 실행하는 함수입니다. */
export type SetupStep = () => Promise<SetupResult>

/**
 * CLI 존재 여부, 버전 확인, 인증 상태를 공통 순서로 점검합니다.
 *
 * @param options - 준비할 CLI의 명령과 설치, 인증 설정입니다.
 * @returns CLI 준비 결과입니다.
 */
export async function setupTool(options: SetupToolOptions): Promise<SetupResult> {
  log.step(chalk.bold(`${options.name} 준비`))

  const check = spinner()
  check.start(`${options.command} 확인 중...`)
  let exists = await commandExists(options.command)
  const commandLabel = options.commandLabel ?? options.command
  check.stop(exists ? `${commandLabel} 확인 완료` : `${options.command}를 찾을 수 없음`)

  if (!exists) {
    const installed = await offerInstall(options)

    if (!installed) {
      return {
        name: options.name,
        status: 'skipped',
        message: `${options.name} CLI 설치를 건너뜀`,
      }
    }

    exists = await commandExists(options.command)
    if (!exists) {
      return {
        name: options.name,
        status: 'failed',
        message: `${options.command} 설치 후에도 명령을 찾을 수 없음`,
      }
    }
  }

  try {
    await runCommandQuietly(options.command, options.versionArgs)
  } catch (error) {
    return {
      name: options.name,
      status: 'failed',
      message: `${options.name} CLI 버전 확인 실패: ${formatError(error)}`,
    }
  }

  const {authCheckArgs, loginArgs} = options

  if (!authCheckArgs || !loginArgs) {
    return {
      name: options.name,
      status: 'ready',
      message: `${options.name} CLI 사용 가능`,
    }
  }

  const loggedIn = await isAuthenticated(options.command, authCheckArgs)
  if (loggedIn) {
    return {
      name: options.name,
      status: 'ready',
      message: `${options.name} CLI 사용 가능`,
    }
  }

  const shouldLogin = await confirm({
    message: `${options.name} 로그인을 진행할까요?`,
    initialValue: true,
  })

  if (isCancel(shouldLogin) || !shouldLogin) {
    return {
      name: options.name,
      status: 'skipped',
      message: `${options.name} 로그인을 건너뜀`,
    }
  }

  try {
    await runCommand(
      options.command,
      loginArgs,
      options.loginLabel ?? `${options.command} ${loginArgs.join(' ')}`,
    )
  } catch (error) {
    return {
      name: options.name,
      status: 'failed',
      message: `${options.name} 로그인 실패: ${formatError(error)}`,
    }
  }

  const ready = await isAuthenticated(options.command, authCheckArgs)
  return ready
    ? {
        name: options.name,
        status: 'ready',
        message: `${options.name} 로그인 완료`,
      }
    : {
        name: options.name,
        status: 'failed',
        message: `${options.name} 로그인 상태 확인 실패`,
      }
}

/**
 * 현재 플랫폼에 맞는 설치 명령을 안내하고 사용자가 승인하면 실행합니다.
 *
 * @param options - 설치 안내에 사용할 CLI 설정입니다.
 * @returns 설치를 시도해 성공했으면 `true`, 건너뛰거나 실패하면 `false`입니다.
 */
async function offerInstall(options: SetupToolOptions): Promise<boolean> {
  const platform = detectPlatform()
  const installCommand = options.install[platform]

  if (installCommand.command === options.command && installCommand.args.length === 0) {
    log.warn(`${options.name} CLI 설치가 필요합니다: ${installCommand.label}`)
    return false
  }

  const answer = await select({
    message: `${options.name} CLI가 없습니다. 설치하시겠습니까?`,
    options: [
      {
        label: `설치 (${installCommand.label})`,
        value: 'install',
      },
      {
        label: '건너뛰기',
        value: 'skip',
      },
    ],
  })

  if (isCancel(answer) || answer === 'skip') {
    return false
  }

  try {
    await runCommand(installCommand.command, installCommand.args, installCommand.label)
    return true
  } catch (error) {
    log.error(error instanceof Error ? error.message : `${options.name} 설치 실패`)
    return false
  }
}

/**
 * 도구별 인증 확인 명령을 실행해 로그인 상태인지 확인합니다.
 *
 * @param options - 인증 확인 명령을 포함한 CLI 설정입니다.
 * @returns 인증되어 있으면 `true`, 아니면 `false`입니다.
 */
async function isAuthenticated(command: string, authCheckArgs: string[]): Promise<boolean> {
  try {
    await runCommandQuietly(command, authCheckArgs)
    return true
  } catch {
    return false
  }
}

/**
 * 알 수 없는 오류 값을 사용자에게 보여줄 문자열로 변환합니다.
 *
 * @param error - 변환할 오류 값입니다.
 * @returns 오류 메시지 문자열입니다.
 */
function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
