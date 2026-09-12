import {type ProgressPort, runCreateProjectWorkflow} from './core/workflow'
import {
  type DesktopProjectRequest,
  desktopProjectRequestSchema,
} from './core/schemas/desktop-project-request'
import {err, errorMessage, ok, type Result} from './core/result'
import {parseResult} from './core/schemas/parse'
import {createGitHubRepository} from './steps/create-github-repository'
import {deployVercelProject} from './steps/deploy-vercel-project'
import {generateTemplate} from './steps/generate-template'
import {installDependencies} from './steps/install-dependencies'
import {commandExists} from './utils/command-exists'
import {runCommandInBackground, runCommandQuietly} from './utils/run-command'

export type {DesktopProjectRequest}

const EVENT_PREFIX = 'VIBE_EVENT:'
const RESULT_PREFIX = 'VIBE_RESULT:'
const ERROR_PREFIX = 'VIBE_ERROR:'

function emit(prefix: string, value: unknown) {
  process.stdout.write(`${prefix}${JSON.stringify(value)}\n`)
}

async function assertCommand(command: string, message: string): Promise<void> {
  if (!(await commandExists(command))) {
    throw new Error(message)
  }
}

async function prepareTools(request: DesktopProjectRequest): Promise<Result<void>> {
  try {
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
    return ok(undefined)
  } catch (error) {
    return err(errorMessage(error))
  }
}

/** Executes the shared project workflow without terminal prompts for the Tauri host. */
export async function runDesktopProjectWorkflow(
  request: DesktopProjectRequest,
): Promise<Result<{githubRepository: string; deploymentUrl?: string}>> {
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

  const workflowResult = await runCreateProjectWorkflow(
    request,
    {
      prepareTools: async () => {
        const result = await prepareTools(request)
        if (!result.ok) {
          // Phase 1→2 temporary bridge into Promise<void> workflow operations.
          throw new Error(result.message)
        }
      },
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
  if (!workflowResult.ok) {
    return workflowResult
  }

  try {
    if (request.createGithubRepository) {
      await resolveGithubRepository()
    }
  } catch (error) {
    return err(errorMessage(error))
  }

  return ok({
    githubRepository,
    deploymentUrl,
  })
}

export async function runDesktopWorker(
  argv = process.argv,
): Promise<Result<{githubRepository: string; deploymentUrl?: string}>> {
  const [, , rawRequest] = argv
  if (!rawRequest) {
    return err('Desktop project request is required.')
  }

  let request: unknown
  try {
    request = JSON.parse(rawRequest)
  } catch {
    return err('Desktop project request is invalid JSON.')
  }
  const parsed = parseResult(desktopProjectRequestSchema, request)
  if (!parsed.ok) {
    return parsed
  }
  return runDesktopProjectWorkflow(parsed.value)
}

/** CLI entry wrapper used when the desktop worker is launched as a process. */
export async function runDesktopWorkerCli(argv = process.argv) {
  try {
    const result = await runDesktopWorker(argv)
    if (!result.ok) {
      emit(ERROR_PREFIX, {message: result.message})
      process.exitCode = 1
      return
    }
    emit(RESULT_PREFIX, result.value)
  } catch (error) {
    emit(ERROR_PREFIX, {message: errorMessage(error)})
    process.exitCode = 1
  }
}

/* v8 ignore next 3 */
if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  await runDesktopWorkerCli()
}
