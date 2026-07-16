import {
  type CreateProjectRequest,
  type ProgressPort,
  runCreateProjectWorkflow,
  type WorkflowStepId,
} from './core/workflow'
import {createGitHubRepository} from './steps/create-github-repository'
import {deployVercelProject} from './steps/deploy-vercel-project'
import {generateTemplate} from './steps/generate-template'
import {installDependencies} from './steps/install-dependencies'
import {commandExists} from './utils/command-exists'
import {runCommandInBackground, runCommandQuietly} from './utils/run-command'

export type DesktopProjectRequest = CreateProjectRequest & {
  gitAuthorName: string
  gitAuthorEmail: string
  templateDir: string
  resumeFromStep?: WorkflowStepId
}

const EVENT_PREFIX = 'VIBE_EVENT:'
const RESULT_PREFIX = 'VIBE_RESULT:'
const ERROR_PREFIX = 'VIBE_ERROR:'

function emit(prefix: string, value: unknown) {
  process.stdout.write(`${prefix}${JSON.stringify(value)}\n`)
}

async function assertCommand(command: string, message: string) {
  if (!(await commandExists(command))) {
    throw new Error(message)
  }
}

async function prepareTools(request: DesktopProjectRequest) {
  await assertCommand('git', 'Git이 필요합니다. 도구 준비 화면에서 Git을 설치해주세요.')
  await assertCommand('pnpm', 'pnpm이 필요합니다. 도구 준비 화면에서 Node와 pnpm을 설치해주세요.')

  if (request.createGithubRepository) {
    await assertCommand('gh', 'GitHub CLI가 필요합니다. 도구 준비 화면에서 설치해주세요.')
    await runCommandQuietly('gh', ['auth', 'status'])
  }
  if (request.deployVercel) {
    await assertCommand('vercel', 'Vercel CLI가 필요합니다. 도구 준비 화면에서 설치해주세요.')
    await runCommandQuietly('vercel', ['whoami'])
  }
  if (request.openCodex) {
    await assertCommand('codex', 'Codex CLI가 필요합니다. 도구 준비 화면에서 설치해주세요.')
    await runCommandQuietly('codex', ['login', 'status'])
  }
}

/** Executes the shared project workflow without terminal prompts for the Tauri host. */
export async function runDesktopProjectWorkflow(request: DesktopProjectRequest) {
  let githubRepository = ''
  let deploymentUrl: string | undefined
  const progress: ProgressPort = {report: (event) => emit(EVENT_PREFIX, event)}
  const resolveGithubRepository = async () => {
    if (!githubRepository) {
      const result = await runCommandQuietly(
        'gh',
        ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'],
        request.projectDir,
      )
      githubRepository = result.stdout.trim()
    }
    return githubRepository
  }

  await runCreateProjectWorkflow(
    request,
    {
      prepareTools: () => prepareTools(request),
      generateTemplate: () =>
        generateTemplate(request.projectDir, {projectName: request.projectName}, request.templateDir),
      installDependencies: async () => {
        await installDependencies(request.projectDir)
      },
      createGithubRepository: async () => {
        githubRepository = await createGitHubRepository(request.projectDir, request.projectName, {
          name: request.gitAuthorName,
          email: request.gitAuthorEmail,
        })
      },
      deployVercel: async () => {
        deploymentUrl = await deployVercelProject(request.projectDir, request.projectName, {
          githubRepository: await resolveGithubRepository(),
        })
      },
      launchCodex: async () => {
        await runCommandQuietly('codex', ['app', request.projectDir])
      },
      startDevServer: async () => {
        runCommandInBackground('pnpm', ['run', 'dev'], 'pnpm run dev', request.projectDir)
      },
    },
    progress,
    {startAt: request.resumeFromStep},
  )

  if (request.createGithubRepository) {
    await resolveGithubRepository()
  }
  return {
    githubRepository,
    deploymentUrl,
  }
}

export async function runDesktopWorker(argv = process.argv) {
  const [, , rawRequest] = argv
  if (!rawRequest) {
    throw new Error('Desktop project request is required.')
  }

  const request = JSON.parse(rawRequest) as DesktopProjectRequest
  const result = await runDesktopProjectWorkflow(request)
  emit(RESULT_PREFIX, result)
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  try {
    await runDesktopWorker()
  } catch (error) {
    emit(ERROR_PREFIX, {message: error instanceof Error ? error.message : String(error)})
    process.exitCode = 1
  }
}
