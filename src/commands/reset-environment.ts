import {spawn} from 'node:child_process'
import {constants} from 'node:fs'
import {access, rm} from 'node:fs/promises'
import {homedir} from 'node:os'
import path from 'node:path'
import {intro, isCancel, log, note, outro, text} from '@clack/prompts'
import chalk from 'chalk'
import {commandExists} from '../utils/command-exists'

/** CLI 환경 초기화를 위해 실행할 외부 명령 단계입니다. */
type CommandStep = {
  kind: 'command'
  label: string
  command: string
  args: string[]
}

/** CLI 환경 초기화를 위해 삭제할 파일 또는 폴더 단계입니다. */
type RemoveStep = {
  kind: 'remove'
  label: string
  target: string
}

/** CLI 환경 초기화에서 수행할 수 있는 단계입니다. */
type Step = CommandStep | RemoveStep
/** 전역 패키지 제거를 지원하는 패키지 매니저입니다. */
type PackageManager = 'pnpm' | 'npm'

/** reset 명령 실행 옵션입니다. */
type ResetOptions = {
  dryRun?: boolean
  yes?: boolean
}

/** 사용자별 CLI 설정 파일을 찾기 위한 홈 폴더입니다. */
const home = homedir()
/** 플랫폼별 설치 제거 명령과 설정 경로를 고르기 위한 Node.js 플랫폼입니다. */
const {platform} = process

/**
 * GitHub, Vercel, Codex CLI의 설치와 인증 파일을 초기화합니다.
 *
 * @param options - dry-run 실행과 확인 프롬프트 생략 여부입니다.
 * @returns 모든 단계가 성공하거나 건너뛰면 `true`, 실패한 단계가 있으면 `false`입니다.
 */
export async function runResetEnvironment(options: ResetOptions = {}): Promise<boolean> {
  const packageManagers = await globalPackageManagers()
  const steps: Step[] = [...githubSteps(), ...vercelSteps(packageManagers), ...codexSteps(packageManagers)]

  intro(chalk.cyan('create-vibe-start reset'))

  note(steps.map((step) => `- ${step.label}`).join('\n'), 'GitHub, Vercel, Codex CLI 환경을 초기화합니다.')

  if (!options.yes) {
    const answer = await text({
      message: '계속하려면 reset을 입력하세요.',
      placeholder: 'reset',
      validate(value) {
        return value.trim().toLowerCase() === 'reset' ? undefined : 'reset을 입력해야 계속 진행합니다.'
      },
    })

    if (isCancel(answer)) {
      outro(chalk.yellow('초기화를 취소했습니다.'))
      return true
    }

    if (answer.trim().toLowerCase() !== 'reset') {
      outro(chalk.yellow('초기화를 취소했습니다.'))
      return true
    }
  }

  const results = await runSteps(steps, Boolean(options.dryRun))
  const failed = results.some((ok) => !ok)

  outro(failed ? chalk.yellow('초기화가 경고와 함께 완료되었습니다.') : chalk.green('초기화가 완료되었습니다.'))

  return !failed
}

/**
 * 현재 플랫폼에서 GitHub CLI를 초기화하는 단계 목록을 만듭니다.
 *
 * @returns GitHub CLI 초기화 단계 목록입니다.
 */
function githubSteps(): Step[] {
  const steps: Step[] = [
    {
      kind: 'remove',
      label: 'Remove GitHub CLI config/auth files',
      target: path.join(home, '.config', 'gh'),
    },
  ]

  if (platform === 'darwin') {
    steps.unshift({
      kind: 'command',
      label: 'Uninstall GitHub CLI installed by Homebrew',
      command: 'brew',
      args: ['uninstall', 'gh'],
    })
  }

  if (platform === 'win32') {
    steps.unshift({
      kind: 'command',
      label: 'Uninstall GitHub CLI installed by winget',
      command: 'winget',
      args: ['uninstall', '--id', 'GitHub.cli'],
    })
  }

  return steps
}

/**
 * 사용 가능한 전역 패키지 매니저를 감지합니다.
 *
 * @returns PATH에서 찾은 패키지 매니저 목록입니다.
 */
async function globalPackageManagers(): Promise<PackageManager[]> {
  const managers: PackageManager[] = []

  if (await commandExists('pnpm')) {
    managers.push('pnpm')
  }

  if (await commandExists('npm')) {
    managers.push('npm')
  }

  return managers
}

/**
 * Vercel CLI 인증, 패키지, 설정 파일을 초기화하는 단계 목록을 만듭니다.
 *
 * @param packageManagers - 전역 패키지 제거에 사용할 수 있는 패키지 매니저입니다.
 * @returns Vercel CLI 초기화 단계 목록입니다.
 */
function vercelSteps(packageManagers: PackageManager[]): Step[] {
  return [
    {
      kind: 'command',
      label: 'Log out of Vercel CLI',
      command: 'vercel',
      args: ['logout', '--non-interactive'],
    },
    ...uninstallGlobalPackageSteps(packageManagers, 'Vercel CLI', 'vercel'),
    {
      kind: 'remove',
      label: 'Remove Vercel CLI auth/config directory',
      target: path.join(home, '.vercel'),
    },
    {
      kind: 'remove',
      label: 'Remove Vercel CLI config directory',
      target: vercelConfigDirectory(),
    },
    {
      kind: 'remove',
      label: 'Remove Vercel CLI cache directory',
      target: vercelCacheDirectory(),
    },
  ]
}

/**
 * 현재 플랫폼의 Vercel CLI 설정 폴더 경로를 반환합니다.
 *
 * @returns Vercel CLI 설정 폴더 경로입니다.
 */
function vercelConfigDirectory(): string {
  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'com.vercel.cli')
  }

  if (platform === 'win32' && process.env.APPDATA) {
    return path.join(process.env.APPDATA, 'com.vercel.cli')
  }

  return path.join(process.env.XDG_DATA_HOME ?? path.join(home, '.local', 'share'), 'com.vercel.cli')
}

/**
 * 현재 플랫폼의 Vercel CLI 캐시 폴더 경로를 반환합니다.
 *
 * @returns Vercel CLI 캐시 폴더 경로입니다.
 */
function vercelCacheDirectory(): string {
  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Caches', 'com.vercel.cli')
  }

  if (platform === 'win32' && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, 'com.vercel.cli')
  }

  return path.join(home, '.cache', 'com.vercel.cli')
}

/**
 * Codex CLI 인증, 패키지, 설정 파일을 초기화하는 단계 목록을 만듭니다.
 *
 * @param packageManagers - 전역 패키지 제거에 사용할 수 있는 패키지 매니저입니다.
 * @returns Codex CLI 초기화 단계 목록입니다.
 */
function codexSteps(packageManagers: PackageManager[]): Step[] {
  return [
    {
      kind: 'command',
      label: 'Log out of Codex CLI',
      command: 'codex',
      args: ['logout'],
    },
    ...uninstallGlobalPackageSteps(packageManagers, 'Codex CLI', '@openai/codex'),
    {
      kind: 'remove',
      label: 'Remove Codex CLI auth file',
      target: path.join(home, '.codex', 'auth.json'),
    },
  ]
}

/**
 * 감지된 패키지 매니저별 전역 패키지 제거 단계를 만듭니다.
 *
 * @param packageManagers - 전역 패키지 제거에 사용할 패키지 매니저 목록입니다.
 * @param name - 사용자에게 표시할 CLI 이름입니다.
 * @param pkg - 제거할 npm 패키지 이름입니다.
 * @returns 패키지 매니저별 제거 명령 단계 목록입니다.
 */
function uninstallGlobalPackageSteps(packageManagers: PackageManager[], name: string, pkg: string): CommandStep[] {
  return packageManagers.map((packageManager) => {
    if (packageManager === 'pnpm') {
      return {
        kind: 'command',
        label: `Uninstall ${name} installed by pnpm`,
        command: 'pnpm',
        args: ['remove', '-g', pkg],
      }
    }

    return {
      kind: 'command',
      label: `Uninstall ${name} installed by npm`,
      command: 'npm',
      args: ['uninstall', '-g', pkg],
    }
  })
}

/**
 * 초기화 단계를 순서대로 실행합니다.
 *
 * @param steps - 실행할 초기화 단계 목록입니다.
 * @param dryRun - 실제 변경 없이 단계만 출력할지 여부입니다.
 * @returns 각 단계의 성공 여부 목록입니다.
 */
async function runSteps(steps: Step[], dryRun: boolean): Promise<boolean[]> {
  return steps.reduce<Promise<boolean[]>>(async (previous, step) => {
    const results = await previous
    const ok = step.kind === 'command' ? await runCommand(step, dryRun) : await removeTarget(step, dryRun)
    return [...results, ok]
  }, Promise.resolve([]))
}

/**
 * 단일 외부 명령 단계를 실행합니다.
 *
 * @param step - 실행할 명령 단계입니다.
 * @param dryRun - 실제 실행 없이 명령만 출력할지 여부입니다.
 * @returns 명령이 성공했으면 `true`, 실패하면 `false`입니다.
 */
async function runCommand(step: CommandStep, dryRun: boolean): Promise<boolean> {
  if (dryRun) {
    log.info(`[dry-run] ${step.command} ${step.args.join(' ')}`)
    return true
  }

  log.step(chalk.bold(step.label))

  return new Promise((resolve) => {
    const child = spawn(step.command, step.args, {
      stdio: 'inherit',
      shell: false,
    })

    child.on('error', (error) => {
      log.warn(`${step.label} 실행 실패: ${error.message}`)
      resolve(false)
    })

    child.on('exit', (code) => {
      if (code === 0) {
        log.message(chalk.green(`완료: ${step.label}`))
        resolve(true)
        return
      }

      log.warn(`${step.label} 종료 코드: ${code ?? 'unknown'}`)
      resolve(false)
    })
  })
}

/**
 * 단일 파일 또는 폴더 삭제 단계를 실행합니다.
 *
 * @param step - 삭제할 대상 단계입니다.
 * @param dryRun - 실제 삭제 없이 대상만 출력할지 여부입니다.
 * @returns 대상이 없거나 삭제에 성공하면 `true`, 삭제에 실패하면 `false`입니다.
 */
async function removeTarget(step: RemoveStep, dryRun: boolean): Promise<boolean> {
  if (dryRun) {
    log.info(`[dry-run] rm -rf ${step.target}`)
    return true
  }

  if (!(await exists(step.target))) {
    log.message(chalk.dim(`건너뜀: ${step.label}`))
    return true
  }

  try {
    await rm(step.target, {force: true, recursive: true})
    log.message(chalk.green(`삭제 완료: ${step.label}`))
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.warn(`${step.label} 삭제 실패: ${message}`)
    return false
  }
}

/**
 * 파일 시스템 대상이 존재하는지 확인합니다.
 *
 * @param target - 확인할 파일 또는 폴더 경로입니다.
 * @returns 대상이 존재하면 `true`, 아니면 `false`입니다.
 */
async function exists(target: string): Promise<boolean> {
  try {
    await access(target, constants.F_OK)
    return true
  } catch {
    return false
  }
}
