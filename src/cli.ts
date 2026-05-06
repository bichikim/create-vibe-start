#!/usr/bin/env node

import {createRequire} from 'node:module'
import {Command} from 'commander'
import {isCancel, outro} from '@clack/prompts'
import chalk from 'chalk'
import {runResetEnvironment} from './commands/reset-environment'
import {showComplete} from './steps/complete'
import {setupCodex} from './steps/setup-codex'
import {setupGitHub} from './steps/setup-github'
import type {SetupResult, SetupStep} from './steps/setup-tool'
import {setupVercel} from './steps/setup-vercel'
import {showWelcome} from './steps/welcome'

const require = createRequire(import.meta.url)
const packageJson = require('../package.json') as {version: string}

export function createProgram() {
  const program = new Command()
    .name('create-vibe-start')
    .description('Prepare GitHub, Vercel, and Codex CLI environments for vibe coding.')
    .version(packageJson.version)
    .option('--skip-github', 'Skip GitHub CLI setup')
    .option('--skip-vercel', 'Skip Vercel CLI setup')
    .option('--skip-codex', 'Skip Codex CLI setup')
    .action(async (options: {skipGithub?: boolean; skipVercel?: boolean; skipCodex?: boolean}) => {
      try {
        const proceed = await showWelcome()

        if (isCancel(proceed) || !proceed) {
          outro(chalk.yellow('준비가 필요할 때 다시 실행해주세요.'))
          process.exit(0)
          return
        }

        const steps: SetupStep[] = [
          ...(options.skipGithub ? [] : [setupGitHub]),
          ...(options.skipVercel ? [] : [setupVercel]),
          ...(options.skipCodex ? [] : [setupCodex]),
        ]
        const results = await runSetupSteps(steps)

        showComplete(results)
      } catch (error) {
        outro(chalk.red(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'))
        process.exit(1)
        return
      }
    })

  program
    .command('reset')
    .description('Reset GitHub, Vercel, and Codex CLI installs and auth files.')
    .option('--dry-run', 'Print the reset steps without changing anything.')
    .option('--yes, -y', 'Skip the confirmation prompt.')
    .action(async (options: {dryRun?: boolean; yes?: boolean}) => {
      const ok = await runResetEnvironment(options)
      process.exitCode = ok ? 0 : 1
    })

  return program
}

async function runSetupSteps(steps: SetupStep[]): Promise<SetupResult[]> {
  return steps.reduce<Promise<SetupResult[]>>(async (previousResults, step) => {
    const results = await previousResults
    return [...results, await step()]
  }, Promise.resolve([]))
}

export async function runCli(argv = process.argv) {
  await createProgram().parseAsync(argv)
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  await runCli()
}
