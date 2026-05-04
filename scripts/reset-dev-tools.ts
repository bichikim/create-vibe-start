import {createInterface} from 'node:readline/promises'
import {stdin as input, stdout as output} from 'node:process'
import {access, rm} from 'node:fs/promises'
import {constants} from 'node:fs'
import {homedir} from 'node:os'
import path from 'node:path'
import {spawn} from 'node:child_process'

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

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const yes = args.has('--yes') || args.has('-y')

if (args.has('--help') || args.has('-h')) {
  printHelp()
  process.exit(0)
}

const home = homedir()
const {platform} = process

const steps: Step[] = [...githubSteps(), ...vercelSteps(), ...codexSteps()]

console.log('Reset target: GitHub CLI, Vercel CLI, Codex CLI')
console.log('')
console.log('This will remove CLI installs where this project installed them, plus local auth/config files:')
for (const step of steps) {
  console.log(`- ${step.label}`)
}
console.log('')

if (!yes) {
  const confirmed = await confirm('Continue? Type "reset" to proceed: ')
  if (!confirmed) {
    console.log('Canceled.')
    process.exit(0)
  }
}

const results = await runSteps(steps)
const failed = results.some((ok) => !ok)

console.log('')
console.log(failed ? 'Reset completed with warnings.' : 'Reset completed.')
console.log('Run the onboarding flow again to verify a clean first-time setup.')

process.exit(failed ? 1 : 0)

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

async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({input, output})

  try {
    const answer = await rl.question(message)
    return answer.trim().toLowerCase() === 'reset'
  } finally {
    rl.close()
  }
}

async function runSteps(steps: Step[]): Promise<boolean[]> {
  return steps.reduce<Promise<boolean[]>>(async (previous, step) => {
    const results = await previous
    const ok = step.kind === 'command' ? await runCommand(step) : await removeTarget(step)
    return [...results, ok]
  }, Promise.resolve([]))
}

async function runCommand(step: CommandStep): Promise<boolean> {
  if (dryRun) {
    console.log(`[dry-run] ${step.command} ${step.args.join(' ')}`)
    return true
  }

  console.log(`Running: ${step.label}`)

  return new Promise((resolve) => {
    const child = spawn(step.command, step.args, {
      stdio: 'inherit',
      shell: false,
    })

    child.on('error', (error) => {
      console.warn(`Warning: ${step.label} failed to start: ${error.message}`)
      resolve(false)
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolve(true)
        return
      }

      console.warn(`Warning: ${step.label} exited with code ${code ?? 'unknown'}`)
      resolve(false)
    })
  })
}

async function removeTarget(step: RemoveStep): Promise<boolean> {
  if (dryRun) {
    console.log(`[dry-run] rm -rf ${step.target}`)
    return true
  }

  if (!(await exists(step.target))) {
    console.log(`Skipped missing: ${step.label}`)
    return true
  }

  try {
    await rm(step.target, {force: true, recursive: true})
    console.log(`Removed: ${step.label}`)
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`Warning: ${step.label} failed: ${message}`)
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

function printHelp() {
  console.log(`
Usage:
  pnpm reset:dev-tools
  pnpm reset:dev-tools -- --dry-run
  pnpm reset:dev-tools -- --yes

Options:
  --dry-run  Print the reset steps without changing anything.
  --yes, -y  Skip the confirmation prompt.
  --help     Show this help message.
`)
}
