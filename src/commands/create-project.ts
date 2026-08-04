import {confirm, isCancel, outro} from '@clack/prompts'
import chalk from 'chalk'
import {errorMessage, type Result} from '../core/result'
import {type ProgressPort, runWorkflowStep} from '../core/workflow'
import {showComplete} from '../steps/complete'
import {createGitHubRepository} from '../steps/create-github-repository'
import {deployVercelProject} from '../steps/deploy-vercel-project'
import {generateTemplate} from '../steps/generate-template'
import {installDependencies} from '../steps/install-dependencies'
import {launchCodexApp, withCodexAppReadyMessage} from '../steps/launch-codex-app'
import {selectProjectDir} from '../steps/select-project-dir'
import {selectProjectName} from '../steps/select-project-name'
import {setupCodex} from '../steps/setup-codex'
import {setupGitHub} from '../steps/setup-github'
import {type SetupResult, type SetupStep} from '../steps/setup-tool'
import {setupVercel} from '../steps/setup-vercel'
import {showWelcome} from '../steps/welcome'

export interface CreateProjectOptions {
  skipGithub?: boolean
  skipVercel?: boolean
  skipCodex?: boolean
  projectDir?: string
  localSetupPackage?: string
}

interface CreatedProject {
  projectDir: string
  projectName: string
}

const cliWorkflowProgress: ProgressPort = {report: () => undefined}

function exitWithOutro(message: string, exitCode: number) {
  outro(message)
  process.exit(exitCode)
}

function exitOnFailure<ResultValue>(result: Result<ResultValue>): result is Extract<Result<ResultValue>, {ok: false}> {
  if (result.ok) {
    return false
  }
  exitWithOutro(chalk.red(result.message), 1)
  return true
}

async function selectCreatedProject(options: CreateProjectOptions): Promise<CreatedProject | null> {
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

function generateSelectedTemplate(options: CreateProjectOptions, project: CreatedProject) {
  const answers = {projectName: project.projectName}
  if (!options.localSetupPackage) {
    // 일반 사용자에게는 생성 당시의 정식 npm 버전을 참조하는 프로젝트를 만든다.
    return generateTemplate(project.projectDir, answers)
  }

  // 이 옵션은 루트 개발 스크립트가 준비한 tarball을 검증할 때만 사용한다.
  return generateTemplate(project.projectDir, answers, undefined, {
    setupRuntime: {
      kind: 'local-package',
      packagePath: options.localSetupPackage,
    },
  })
}

async function runSelectedSetupSteps(options: CreateProjectOptions): Promise<SetupResult[]> {
  const steps: SetupStep[] = [
    ...(options.skipGithub ? [] : [setupGitHub]),
    ...(options.skipVercel ? [] : [setupVercel]),
    ...(options.skipCodex ? [] : [setupCodex]),
  ]
  const results: SetupResult[] = []
  for (const step of steps) {
    // Setup is intentionally sequential because each step owns an interactive prompt.
    // eslint-disable-next-line no-await-in-loop
    results.push(await step())
  }
  return results
}

async function selectGitHubRepository(options: CreateProjectOptions, results: SetupResult[], project: CreatedProject) {
  const githubResult = results.find((result) => result.name === 'GitHub')
  if (options.skipGithub || githubResult?.status !== 'ready') {
    return false
  }

  const shouldCreate = await confirm({
    message: 'GitHub에 저장소를 만들고 저장할까요?',
    initialValue: true,
  })
  if (isCancel(shouldCreate) || !shouldCreate) {
    return false
  }

  return createGitHubRepository(project.projectDir, project.projectName)
}

async function deploySelectedProject(
  options: CreateProjectOptions,
  results: SetupResult[],
  project: CreatedProject,
  githubRepository: string | false,
) {
  const vercelResult = results.find((result) => result.name === 'Vercel')
  if (options.skipVercel || vercelResult?.status !== 'ready' || !githubRepository) {
    return
  }

  const shouldDeploy = await confirm({
    message: 'Vercel에 프로젝트를 연결하고 배포할까요?',
    initialValue: true,
  })
  if (!isCancel(shouldDeploy) && shouldDeploy) {
    await deployVercelProject(project.projectDir, project.projectName, {githubRepository})
  }
}

/** Runs the interactive create-project use case registered by the root CLI command. */
export async function runCreateProject(options: CreateProjectOptions) {
  try {
    const proceed = await showWelcome()
    if (isCancel(proceed) || !proceed) {
      exitWithOutro(chalk.yellow('준비가 필요할 때 다시 실행해주세요.'), 0)
      return
    }

    const results = await runSelectedSetupSteps(options)
    const shouldCreate = await confirm({message: '새 프로젝트를 만들까요?', initialValue: true})
    if (isCancel(shouldCreate) || !shouldCreate) {
      showComplete(results)
      return
    }

    const project = await selectCreatedProject(options)
    if (project === null) {
      exitWithOutro(chalk.yellow('프로젝트 준비를 취소했습니다.'), 0)
      return
    }

    const templateResult = await runWorkflowStep(
      'generate-template',
      () => generateSelectedTemplate(options, project),
      cliWorkflowProgress,
    )
    if (exitOnFailure(templateResult)) {
      return
    }

    const dependenciesResult = await runWorkflowStep(
      'install-dependencies',
      () => installDependencies(project.projectDir),
      cliWorkflowProgress,
    )
    if (exitOnFailure(dependenciesResult)) {
      return
    }

    const githubResult = await runWorkflowStep(
      'create-github-repository',
      () => selectGitHubRepository(options, results, project),
      cliWorkflowProgress,
    )
    if (exitOnFailure(githubResult)) {
      return
    }

    const vercelResult = await runWorkflowStep(
      'deploy-vercel',
      () => deploySelectedProject(options, results, project, githubResult.value),
      cliWorkflowProgress,
    )
    if (exitOnFailure(vercelResult)) {
      return
    }

    let finalResults = results
    if (!options.skipCodex) {
      const codexResult = results.find((result) => result.name === 'Codex')
      const launchResult = await runWorkflowStep(
        'launch-codex',
        () => launchCodexApp(project.projectDir, codexResult, dependenciesResult.value),
        cliWorkflowProgress,
      )
      if (exitOnFailure(launchResult)) {
        return
      }
      finalResults = withCodexAppReadyMessage(results, launchResult.value)
    }

    showComplete(finalResults)
  } catch (error) {
    exitWithOutro(chalk.red(errorMessage(error)), 1)
  }
}
