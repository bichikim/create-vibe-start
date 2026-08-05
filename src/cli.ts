#!/usr/bin/env node

import {createRequire} from 'node:module'
import {Command} from 'commander'
import {type CreateProjectOptions, runCreateProject} from './commands/create-project'
import {runRepairVercel} from './commands/repair-vercel'
import {runResetEnvironment} from './commands/reset-environment'
import {runSetupProject} from './commands/setup-project'

const require = createRequire(import.meta.url)
const packageJson = require('../package.json') as {version: string}

/** Creates the Commander program and registers each command handler. */
export function createProgram() {
  const program = new Command()
    .name('create-vibe-start')
    .description('Create a new vibe-coding starter project.')
    .version(packageJson.version)
    .option('--skip-github', 'Skip GitHub CLI setup')
    .option('--skip-vercel', 'Skip Vercel CLI setup')
    .option('--skip-codex', 'Skip Codex CLI setup')
    .option('--project-dir <path>', 'Default project working directory')
    // 루트 개발 스크립트가 만든 패키지를 검증할 때만 사용하며 일반 생성 경로에서는 전달하지 않는다.
    .option('--local-setup-package <path>', 'Use a local create-vibe-start package tarball in the generated project')
    .action((options: CreateProjectOptions) => runCreateProject(options))

  // 생성 시 배포를 건너뛴 사용자도 프로젝트 루트에서 같은 설정 흐름을 다시 시작할 수 있다.
  program
    .command('setup')
    .description('Configure deployment for an existing generated project.')
    .requiredOption('--dir <path>', 'Generated project directory')
    .option('--check', 'Verify that the generated project can load the setup runtime without prompts')
    .action((options: unknown) => runSetupProject(options))

  program
    .command('repair')
    .description('Repair partial setup failures.')
    .command('vercel')
    .description('Repair Vercel setup for an existing generated project.')
    .requiredOption('--dir <path>', 'Generated project directory')
    .requiredOption('--project-name <name>', 'Vercel project name')
    .option('--github-repository <owner/name>', 'GitHub repository to connect when no Vercel link exists')
    .action((options: unknown) => runRepairVercel(options))

  program
    .command('reset')
    .description('Reset GitHub, Vercel, and Codex CLI installs and auth files.')
    .option('--dry-run', 'Print the reset steps without changing anything.')
    .option('--yes, -y', 'Skip the confirmation prompt.')
    .action(async (options: {dryRun?: boolean; yes?: boolean}) => {
      const succeeded = await runResetEnvironment(options)
      process.exitCode = succeeded ? 0 : 1
    })

  return program
}

/** Runs the CLI with the provided process arguments. */
export async function runCli(argv = process.argv) {
  await createProgram().parseAsync(argv)
}

/* v8 ignore next 3 */
if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  await runCli()
}
