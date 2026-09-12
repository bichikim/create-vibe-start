import {outro} from '@clack/prompts'
import chalk from 'chalk'
import {errorMessage} from '../core/result'
import {parseOrThrow} from '../core/schemas/parse'
import {repairVercelOptionsSchema} from '../core/schemas/repair-vercel-options'
import {deployVercelProject} from '../steps/deploy-vercel-project'

/** Runs the Vercel repair subcommand and renders its terminal result. */
export async function runRepairVercel(options: unknown) {
  try {
    const parsed = parseOrThrow(repairVercelOptionsSchema, options)
    await deployVercelProject(parsed.dir, parsed.projectName, {
      githubRepository: parsed.githubRepository,
    })
    outro(chalk.green('Vercel repair completed.'))
  } catch (error) {
    outro(chalk.red(errorMessage(error)))
    process.exit(1)
  }
}
