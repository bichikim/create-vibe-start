import {confirm, isCancel, log, select, spinner} from '@clack/prompts'
import chalk from 'chalk'
import {commandExists} from '../utils/command-exists'
import {detectPlatform} from '../utils/detect-platform'
import {runCommand, runCommandQuietly} from '../utils/run-command'

type PlatformCommand = {
  command: string
  args: string[]
  label: string
}

type SetupToolOptions = {
  name: string
  command: string
  commandLabel?: string
  versionArgs: string[]
  authCheckArgs: string[]
  loginArgs: string[]
  loginLabel?: string
  install: Record<'macos' | 'linux' | 'windows', PlatformCommand>
}

export type SetupResult = {
  name: string
  status: 'ready' | 'skipped' | 'failed'
  message: string
}

export type SetupStep = () => Promise<SetupResult>

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

  const loggedIn = await isAuthenticated(options)
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
      options.loginArgs,
      options.loginLabel ?? `${options.command} ${options.loginArgs.join(' ')}`,
    )
  } catch (error) {
    return {
      name: options.name,
      status: 'failed',
      message: `${options.name} 로그인 실패: ${formatError(error)}`,
    }
  }

  const ready = await isAuthenticated(options)
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

async function isAuthenticated(options: SetupToolOptions): Promise<boolean> {
  try {
    await runCommandQuietly(options.command, options.authCheckArgs)
    return true
  } catch {
    return false
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
