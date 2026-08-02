#!/usr/bin/env node

import {createRequire} from 'node:module'
import {Command} from 'commander'
import {confirm, isCancel, outro} from '@clack/prompts'
import chalk from 'chalk'
import {runResetEnvironment} from './commands/reset-environment'
import {parseOrThrow} from './core/schemas/parse'
import {repairVercelOptionsSchema} from './core/schemas/repair-vercel-options'
import {type ProgressPort, runWorkflowStep} from './core/workflow'
import {createGitHubRepository} from './steps/create-github-repository'
import {deployVercelProject} from './steps/deploy-vercel-project'
import {generateTemplate} from './steps/generate-template'
import {installDependencies} from './steps/install-dependencies'
import {launchCodexApp, withCodexAppReadyMessage} from './steps/launch-codex-app'
import {showComplete} from './steps/complete'
import {selectProjectDir} from './steps/select-project-dir'
import {selectProjectName} from './steps/select-project-name'
import {setupCodex} from './steps/setup-codex'
import {setupGitHub} from './steps/setup-github'
import type {SetupResult, SetupStep} from './steps/setup-tool'
import {setupVercel} from './steps/setup-vercel'
import {showWelcome} from './steps/welcome'

/** CommonJS 전용 JSON 로딩을 위해 현재 모듈 기준 require를 만듭니다. */
const require = createRequire(import.meta.url)
/** CLI 버전 표시를 위해 package.json의 버전만 읽습니다. */
const packageJson = require('../package.json') as {version: string}

type CliOptions = {
  skipGithub?: boolean
  skipVercel?: boolean
  skipCodex?: boolean
  projectDir?: string
}

type CreatedProject = {
  projectDir: string
  projectName: string
}

const cliWorkflowProgress: ProgressPort = {report: () => undefined}

function exitWithOutro(message: string, exitCode: number) {
  outro(message)
  process.exit(exitCode)
}

async function selectCreatedProject(options: CliOptions): Promise<CreatedProject | null> {
  const projectName = await selectProjectName()
  if (projectName === null) {
    return null
  }

  const projectDir = await selectProjectDir({defaultDir: options.projectDir ?? `./${projectName}`})
  if (projectDir === null) {
    return null
  }

  return {projectDir, projectName}
}

async function shouldProceed(): Promise<boolean> {
  const proceed = await showWelcome()
  return !isCancel(proceed) && Boolean(proceed)
}

async function runSelectedSetupSteps(options: CliOptions): Promise<SetupResult[]> {
  const steps: SetupStep[] = [
    ...(options.skipGithub ? [] : [setupGitHub]),
    ...(options.skipVercel ? [] : [setupVercel]),
    ...(options.skipCodex ? [] : [setupCodex]),
  ]
  return runSetupSteps(steps)
}

async function shouldCreateProject(): Promise<boolean> {
  const response = await confirm({
    message: '새 프로젝트를 만들까요?',
    initialValue: true,
  })
  return !isCancel(response) && Boolean(response)
}

/**
 * create-vibe-start 명령과 하위 명령을 구성합니다.
 *
 * @returns 실행 준비가 끝난 Commander 프로그램입니다.
 */
export function createProgram() {
  const program = new Command()
    .name('create-vibe-start')
    .description('Create a new vibe-coding starter project.')
    .version(packageJson.version)
    .option('--skip-github', 'Skip GitHub CLI setup')
    .option('--skip-vercel', 'Skip Vercel CLI setup')
    .option('--skip-codex', 'Skip Codex CLI setup')
    .option('--project-dir <path>', 'Default project working directory')
    .action(async (options: CliOptions) => {
      try {
        if (!(await shouldProceed())) {
          exitWithOutro(chalk.yellow('준비가 필요할 때 다시 실행해주세요.'), 0)
          return
        }

        const results = await runSelectedSetupSteps(options)
        if (!(await shouldCreateProject())) {
          showComplete(results)
          return
        }

        const createdProject = await selectCreatedProject(options)
        if (createdProject === null) {
          exitWithOutro(chalk.yellow('프로젝트 준비를 취소했습니다.'), 0)
          return
        }

        const templateResult = await runWorkflowStep(
          'generate-template',
          () => generateTemplate(createdProject.projectDir, {projectName: createdProject.projectName}),
          cliWorkflowProgress,
        )
        if (!templateResult.ok) {
          exitWithOutro(chalk.red(templateResult.message), 1)
          return
        }

        const dependenciesResult = await runWorkflowStep(
          'install-dependencies',
          () => installDependencies(createdProject.projectDir),
          cliWorkflowProgress,
        )
        if (!dependenciesResult.ok) {
          exitWithOutro(chalk.red(dependenciesResult.message), 1)
          return
        }
        const dependenciesInstalled = dependenciesResult.value

        const githubRepositoryResult = await runWorkflowStep(
          'create-github-repository',
          () => maybeCreateGitHubRepository(options, results, createdProject),
          cliWorkflowProgress,
        )
        if (!githubRepositoryResult.ok) {
          exitWithOutro(chalk.red(githubRepositoryResult.message), 1)
          return
        }

        const vercelDeploymentResult = await runWorkflowStep(
          'deploy-vercel',
          () => maybeDeployVercelProject(options, results, createdProject, githubRepositoryResult.value),
          cliWorkflowProgress,
        )
        if (!vercelDeploymentResult.ok) {
          exitWithOutro(chalk.red(vercelDeploymentResult.message), 1)
          return
        }

        let finalResults = results
        if (!options.skipCodex) {
          const codexResult = results.find((result) => result.name === 'Codex')
          const launchCodexResult = await runWorkflowStep(
            'launch-codex',
            () => launchCodexApp(createdProject.projectDir, codexResult, dependenciesInstalled),
            cliWorkflowProgress,
          )
          if (!launchCodexResult.ok) {
            exitWithOutro(chalk.red(launchCodexResult.message), 1)
            return
          }
          finalResults = withCodexAppReadyMessage(results, launchCodexResult.value)
        }

        showComplete(finalResults)
      } catch (error) {
        exitWithOutro(chalk.red(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'), 1)
        return
      }
    })

  const repairCommand = program.command('repair').description('Repair partial setup failures.')

  repairCommand
    .command('vercel')
    .description('Repair Vercel setup for an existing generated project.')
    .requiredOption('--dir <path>', 'Generated project directory')
    .requiredOption('--project-name <name>', 'Vercel project name')
    .option('--github-repository <owner/name>', 'GitHub repository to connect when no Vercel link exists')
    .action(async (options: unknown) => {
      try {
        const parsed = parseOrThrow(repairVercelOptionsSchema, options)
        await deployVercelProject(parsed.dir, parsed.projectName, {
          githubRepository: parsed.githubRepository,
        })
        outro(chalk.green('Vercel repair completed.'))
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
 * 사용자가 원하면 생성된 프로젝트를 GitHub 저장소로 올립니다.
 *
 * @returns 생성된 GitHub 저장소의 owner/name 형식 이름입니다.
 */
async function maybeCreateGitHubRepository(
  options: CliOptions,
  results: SetupResult[],
  createdProject: CreatedProject,
) {
  const githubResult = results.find((result) => result.name === 'GitHub')
  if (options.skipGithub || githubResult?.status !== 'ready') {
    return false
  }

  const shouldCreateGitHubRepository = await confirm({
    message: 'GitHub에 저장소를 만들고 저장할까요?',
    initialValue: true,
  })

  if (isCancel(shouldCreateGitHubRepository) || !shouldCreateGitHubRepository) {
    return false
  }

  return createGitHubRepository(createdProject.projectDir, createdProject.projectName)
}

/** GitHub 저장소가 준비된 프로젝트를 사용자가 원하면 Vercel에 배포합니다. */
async function maybeDeployVercelProject(
  options: CliOptions,
  results: SetupResult[],
  createdProject: CreatedProject,
  githubRepository: string | false,
) {
  const vercelResult = results.find((result) => result.name === 'Vercel')
  if (options.skipVercel || vercelResult?.status !== 'ready' || !githubRepository) {
    return
  }

  const shouldDeployVercelProject = await confirm({
    message: 'Vercel에 프로젝트를 연결하고 배포할까요?',
    initialValue: true,
  })

  if (!isCancel(shouldDeployVercelProject) && shouldDeployVercelProject) {
    await deployVercelProject(createdProject.projectDir, createdProject.projectName, {githubRepository})
  }
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

// Ignored because this guard is only exercised by executing the built CLI as a separate Node process.
/* v8 ignore next 3 */
if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  await runCli()
}
