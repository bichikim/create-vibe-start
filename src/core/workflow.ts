import {assertValidProjectName} from './project-name'

export type ToolId = 'git' | 'gh' | 'node' | 'pnpm' | 'vercel' | 'codex'

export type WorkflowStepId =
  | 'prepare-tools'
  | 'generate-template'
  | 'install-dependencies'
  | 'create-github-repository'
  | 'deploy-vercel'
  | 'launch-codex'
  | 'start-dev-server'

export type WorkflowStatus = 'pending' | 'running' | 'waiting-user' | 'succeeded' | 'failed' | 'cancelled'

export type WorkflowEvent = {
  stepId: WorkflowStepId
  status: WorkflowStatus
  message: string
  detail?: string
}

export type CreateProjectRequest = {
  projectName: string
  projectDir: string
  createGithubRepository: boolean
  deployVercel: boolean
  openCodex: boolean
  startDevServer: boolean
}

export type ProcessRequest = {
  tool: ToolId
  operation: string
  args: string[]
  cwd?: string
  env?: Record<string, string>
  background?: boolean
}

export type ProcessResult = {
  exitCode: number
  stdout: string
  stderr: string
}

export type ProcessOutput = {
  executionId: string
  stream: 'stdout' | 'stderr'
  text: string
}

export interface ProcessPort {
  run(request: ProcessRequest): Promise<ProcessResult>
  cancel(executionId: string): Promise<void>
  writeInput(executionId: string, input: string): Promise<void>
  subscribeOutput(listener: (output: ProcessOutput) => void): () => void
}

export interface FileSystemPort {
  copy(source: string, destination: string): Promise<void>
  readText(path: string): Promise<string>
  writeText(path: string, contents: string): Promise<void>
  exists(path: string): Promise<boolean>
}

export interface InteractionPort {
  confirm(message: string, initialValue?: boolean): Promise<boolean>
  input(message: string, initialValue?: string): Promise<string | null>
  selectDirectory(defaultPath?: string): Promise<string | null>
}

export interface ProgressPort {
  report(event: WorkflowEvent): void | Promise<void>
}

export interface ToolchainPort {
  inspect(tool: ToolId): Promise<{installed: boolean; authenticated?: boolean; version?: string}>
  install(tool: ToolId): Promise<void>
  login(tool: ToolId): Promise<void>
}

export interface ProjectWorkflowOperations {
  prepareTools(request: CreateProjectRequest): Promise<void>
  generateTemplate(request: CreateProjectRequest): Promise<void>
  installDependencies(request: CreateProjectRequest): Promise<void>
  createGithubRepository(request: CreateProjectRequest): Promise<void>
  deployVercel(request: CreateProjectRequest): Promise<void>
  launchCodex(request: CreateProjectRequest): Promise<void>
  startDevServer(request: CreateProjectRequest): Promise<void>
}

export type RunWorkflowOptions = {
  startAt?: WorkflowStepId
}

const stepMessages: Record<WorkflowStepId, string> = {
  'prepare-tools': '개발 도구 준비',
  'generate-template': '프로젝트 템플릿 생성',
  'install-dependencies': '프로젝트 의존성 설치',
  'create-github-repository': 'GitHub 저장소 생성',
  'deploy-vercel': 'Vercel 배포',
  'launch-codex': 'Codex 앱 실행',
  'start-dev-server': '개발 서버 실행',
}

/** A workflow cancellation that should be shown as a neutral user action. */
export class WorkflowCancelledError extends Error {
  constructor(message = '작업이 취소되었습니다.') {
    super(message)
    this.name = 'WorkflowCancelledError'
  }
}

/** Validates a project request before files or external services are changed. */
export function validateCreateProjectRequest(request: CreateProjectRequest) {
  assertValidProjectName(request.projectName)
  if (!request.projectDir.trim()) {
    throw new Error('프로젝트 폴더를 선택해주세요.')
  }
  if (request.deployVercel && !request.createGithubRepository) {
    throw new Error('Vercel 배포에는 GitHub 저장소 생성이 필요합니다.')
  }
}

/** Runs one observable workflow step and reports its terminal status. */
export async function runWorkflowStep<Result>(
  stepId: WorkflowStepId,
  operation: () => Promise<Result>,
  progress: ProgressPort,
) {
  const message = stepMessages[stepId]
  await progress.report({stepId, status: 'running', message})
  try {
    const result = await operation()
    await progress.report({stepId, status: 'succeeded', message})
    return result
  } catch (error) {
    const cancelled = error instanceof WorkflowCancelledError
    await progress.report({
      stepId,
      status: cancelled ? 'cancelled' : 'failed',
      message,
      detail: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/** Runs the desktop-friendly project creation flow through injected platform operations. */
export async function runCreateProjectWorkflow(
  request: CreateProjectRequest,
  operations: ProjectWorkflowOperations,
  progress: ProgressPort,
  options: RunWorkflowOptions = {},
) {
  validateCreateProjectRequest(request)

  const steps: Array<[WorkflowStepId, () => Promise<void>]> = [
    ['prepare-tools', () => operations.prepareTools(request)],
    ['generate-template', () => operations.generateTemplate(request)],
    ['install-dependencies', () => operations.installDependencies(request)],
  ]
  if (request.createGithubRepository) {
    steps.push(['create-github-repository', () => operations.createGithubRepository(request)])
  }
  if (request.deployVercel) {
    steps.push(['deploy-vercel', () => operations.deployVercel(request)])
  }
  if (request.openCodex) {
    steps.push(['launch-codex', () => operations.launchCodex(request)])
  }
  if (request.startDevServer) {
    steps.push(['start-dev-server', () => operations.startDevServer(request)])
  }

  const startIndex = options.startAt ? steps.findIndex(([stepId]) => stepId === options.startAt) : 0
  if (startIndex === -1) {
    throw new Error(`선택하지 않은 단계는 재시도할 수 없습니다: ${options.startAt}`)
  }

  for (const [stepId, operation] of steps.slice(startIndex)) {
    // Workflow steps intentionally mutate the result of the previous step.
    // eslint-disable-next-line no-await-in-loop
    await runWorkflowStep(stepId, operation, progress)
  }
}
