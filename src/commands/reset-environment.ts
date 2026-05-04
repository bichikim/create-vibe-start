import {spawn} from 'node:child_process'
import {constants} from 'node:fs'
import {access, rm} from 'node:fs/promises'
import {homedir} from 'node:os'
import path from 'node:path'
import {intro, isCancel, log, note, outro, text} from '@clack/prompts'
import chalk from 'chalk'

type CommandStep = {
  kind: 'command'
  label: string
  command: string
  args: string[]
}

type RemoveStep = {
  kind: 'remove'
  label: string
  target: string
}

type Step = CommandStep | RemoveStep

type ResetOptions = {
  dryRun?: boolean
  yes?: boolean
}

const home = homedir()
const {platform} = process

export async function runResetEnvironment(options: ResetOptions = {}): Promise<boolean> {
  const steps: Step[] = [...githubSteps(), ...vercelSteps(), ...codexSteps()]

  intro(chalk.cyan('create-vibe-start reset'))

  note(
    steps.map((step) => `- ${step.label}`).join('\n'),
    'GitHub, Vercel, Codex CLI 환경을 초기화합니다.',
  )

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

  outro(
    failed
      ? chalk.yellow('초기화가 경고와 함께 완료되었습니다. create-vibe-start를 다시 실행해 확인하세요.')
      : chalk.green('초기화가 완료되었습니다. create-vibe-start를 다시 실행해 확인하세요.'),
  )

  return !failed
}

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

function vercelSteps(): Step[] {
  return [
    {
      kind: 'command',
      label: 'Log out of Vercel CLI',
      command: 'vercel',
      args: ['logout', '--non-interactive'],
    },
    {
      kind: 'command',
      label: 'Uninstall Vercel CLI installed by pnpm',
      command: 'pnpm',
      args: ['remove', '-g', 'vercel'],
    },
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

function vercelConfigDirectory(): string {
  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'com.vercel.cli')
  }

  if (platform === 'win32' && process.env.APPDATA) {
    return path.join(process.env.APPDATA, 'com.vercel.cli')
  }

  return path.join(home, '.config', 'com.vercel.cli')
}

function vercelCacheDirectory(): string {
  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Caches', 'com.vercel.cli')
  }

  if (platform === 'win32' && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, 'com.vercel.cli')
  }

  return path.join(home, '.cache', 'com.vercel.cli')
}

function codexSteps(): Step[] {
  return [
    {
      kind: 'command',
      label: 'Log out of Codex CLI',
      command: 'codex',
      args: ['logout'],
    },
    {
      kind: 'command',
      label: 'Uninstall Codex CLI installed by pnpm',
      command: 'pnpm',
      args: ['remove', '-g', '@openai/codex'],
    },
    {
      kind: 'remove',
      label: 'Remove Codex CLI auth file',
      target: path.join(home, '.codex', 'auth.json'),
    },
  ]
}

async function runSteps(steps: Step[], dryRun: boolean): Promise<boolean[]> {
  return steps.reduce<Promise<boolean[]>>(async (previous, step) => {
    const results = await previous
    const ok = step.kind === 'command' ? await runCommand(step, dryRun) : await removeTarget(step, dryRun)
    return [...results, ok]
  }, Promise.resolve([]))
}

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

async function exists(target: string): Promise<boolean> {
  try {
    await access(target, constants.F_OK)
    return true
  } catch {
    return false
  }
}
