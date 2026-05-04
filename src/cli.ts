#!/usr/bin/env node

import {Command} from 'commander'
import {isCancel, outro} from '@clack/prompts'
import chalk from 'chalk'
import {showComplete} from './steps/complete.js'
import {setupCodex} from './steps/setup-codex.js'
import {setupGitHub} from './steps/setup-github.js'
import {setupVercel} from './steps/setup-vercel.js'
import {showWelcome} from './steps/welcome.js'

export function createProgram() {
  return new Command()
    .name('create-vibe-start')
    .description('Prepare GitHub, Vercel, and Codex CLI environments for vibe coding.')
    .version('0.1.0')
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

        const results = []

        if (!options.skipGithub) {
          results.push(await setupGitHub())
        }

        if (!options.skipVercel) {
          results.push(await setupVercel())
        }

        if (!options.skipCodex) {
          results.push(await setupCodex())
        }

        showComplete(results)
      } catch (error) {
        outro(chalk.red(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'))
        process.exit(1)
        return
      }
    })
}

export async function runCli(argv = process.argv) {
  await createProgram().parseAsync(argv)
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  await runCli()
}
