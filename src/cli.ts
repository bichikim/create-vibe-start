#!/usr/bin/env node

import {createRequire} from 'node:module'
import {Command} from 'commander'
import {isCancel, outro} from '@clack/prompts'
import chalk from 'chalk'
import {runResetEnvironment} from './commands/reset-environment'
import {generateTemplate} from './steps/generate-template'
import {showComplete} from './steps/complete'
import {selectProjectDir} from './steps/select-project-dir'
import {setupCodex} from './steps/setup-codex'
import {setupGitHub} from './steps/setup-github'
import type {SetupResult, SetupStep} from './steps/setup-tool'
import {setupVercel} from './steps/setup-vercel'
import {showWelcome} from './steps/welcome'

/** CommonJS 전용 JSON 로딩을 위해 현재 모듈 기준 require를 만듭니다. */
const require = createRequire(import.meta.url)
/** CLI 버전 표시를 위해 package.json의 버전만 읽습니다. */
const packageJson = require('../package.json') as {version: string}

/**
 * create-vibe-start 명령과 하위 명령을 구성합니다.
 *
 * @returns 실행 준비가 끝난 Commander 프로그램입니다.
 */
export function createProgram() {
  const program = new Command()
    .name('create-vibe-start')
    .description('Prepare GitHub, Vercel, and Codex CLI environments for vibe coding.')
    .version(packageJson.version)
    .option('--skip-github', 'Skip GitHub CLI setup')
    .option('--skip-vercel', 'Skip Vercel CLI setup')
    .option('--skip-codex', 'Skip Codex CLI setup')
    .option('--project-dir <path>', 'Default project working directory')
    .action(async (options: {skipGithub?: boolean; skipVercel?: boolean; skipCodex?: boolean; projectDir?: string}) => {
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
        const projectDir = await selectProjectDir({defaultDir: options.projectDir ?? '.'})

        if (projectDir === null) {
          outro(chalk.yellow('프로젝트 준비를 취소했습니다.'))
          process.exit(0)
          return
        }

        await generateTemplate(projectDir)

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

/**
 * 선택된 CLI 준비 단계를 순서대로 실행합니다.
 *
 * @param steps - 실행할 준비 단계 목록입니다.
 * @returns 각 준비 단계의 실행 결과입니다.
 */
async function runSetupSteps(steps: SetupStep[]): Promise<SetupResult[]> {
  return steps.reduce<Promise<SetupResult[]>>(async (previousResults, step) => {
    const results = await previousResults
    return [...results, await step()]
  }, Promise.resolve([]))
}

/**
 * 전달된 인수로 CLI 프로그램을 실행합니다.
 *
 * @param argv - Commander가 파싱할 프로세스 인수입니다.
 */
export async function runCli(argv = process.argv) {
  await createProgram().parseAsync(argv)
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  await runCli()
}
