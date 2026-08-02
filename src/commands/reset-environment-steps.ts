import {homedir} from 'node:os'
import path from 'node:path'
import {userCacheDirectory, userDataDirectory} from '../utils/user-directories'

export interface CommandStep {
  kind: 'command'
  label: string
  command: string
  args: string[]
}

export interface RemoveStep {
  kind: 'remove'
  label: string
  target: string
}

export type ResetStep = CommandStep | RemoveStep
export type PackageManager = 'pnpm' | 'npm'

const home = homedir()
const {platform} = process

/** Builds the platform-specific steps for resetting supported CLI tools. */
export function createResetSteps(packageManagers: PackageManager[]): ResetStep[] {
  return [...githubSteps(), ...vercelSteps(packageManagers), ...codexSteps(packageManagers)]
}

function githubSteps(): ResetStep[] {
  const steps: ResetStep[] = [
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

function vercelSteps(packageManagers: PackageManager[]): ResetStep[] {
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
      target: path.join(userDataDirectory(), 'com.vercel.cli'),
    },
    {
      kind: 'remove',
      label: 'Remove Vercel CLI cache directory',
      target: path.join(userCacheDirectory(), 'com.vercel.cli'),
    },
  ]
}

function codexSteps(packageManagers: PackageManager[]): ResetStep[] {
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

function uninstallGlobalPackageSteps(
  packageManagers: PackageManager[],
  name: string,
  packageName: string,
): CommandStep[] {
  return packageManagers.map((packageManager) => {
    if (packageManager === 'pnpm') {
      return {
        kind: 'command',
        label: `Uninstall ${name} installed by pnpm`,
        command: 'pnpm',
        args: ['remove', '-g', packageName],
      }
    }

    return {
      kind: 'command',
      label: `Uninstall ${name} installed by npm`,
      command: 'npm',
      args: ['uninstall', '-g', packageName],
    }
  })
}
