#!/usr/bin/env node

import {createRequire} from 'node:module'
import {Command} from 'commander'
import {type CreateProjectOptions, runCreateProject} from './commands/create-project'
import {runRepairVercel} from './commands/repair-vercel'
import {runResetEnvironment} from './commands/reset-environment'

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
    .action((options: CreateProjectOptions) => runCreateProject(options))

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
