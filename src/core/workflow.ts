import {type CreateProjectRequest, createProjectRequestSchema} from './schemas/create-project-request'
import {err, errorDetail, errorMessage, ok, type Result} from './result'
import {parseResult} from './schemas/parse'

export type {CreateProjectRequest}

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

export interface ProgressPort {
  report(event: WorkflowEvent): void | Promise<void>
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
export function validateCreateProjectRequest(request: CreateProjectRequest): Result<CreateProjectRequest> {
  return parseResult(createProjectRequestSchema, request)
}

/** Runs one observable workflow step and reports its terminal status. */
export async function runWorkflowStep<ResultValue>(
  stepId: WorkflowStepId,
  operation: () => Promise<ResultValue>,
  progress: ProgressPort,
): Promise<Result<ResultValue>> {
  const message = stepMessages[stepId]
  await progress.report({stepId, status: 'running', message})
  try {
    const result = await operation()
    await progress.report({stepId, status: 'succeeded', message})
    return ok(result)
  } catch (error) {
    const cancelled = error instanceof WorkflowCancelledError
    const detail = errorDetail(error)
    await progress.report({
      stepId,
      status: cancelled ? 'cancelled' : 'failed',
      message,
      detail,
    })
    return cancelled ? err(detail, {cancelled: true}) : err(errorMessage(error))
  }
}

/** Runs the desktop-friendly project creation flow through injected platform operations. */
export async function runCreateProjectWorkflow(
  request: CreateProjectRequest,
  operations: ProjectWorkflowOperations,
  progress: ProgressPort,
  options: RunWorkflowOptions = {},
): Promise<Result<void>> {
  const parsed = validateCreateProjectRequest(request)
  if (!parsed.ok) {
    return parsed
  }
  const validRequest = parsed.value

  const steps: Array<[WorkflowStepId, () => Promise<void>]> = [
    ['prepare-tools', () => operations.prepareTools(validRequest)],
    ['generate-template', () => operations.generateTemplate(validRequest)],
    ['install-dependencies', () => operations.installDependencies(validRequest)],
  ]
  if (validRequest.createGithubRepository) {
    steps.push(['create-github-repository', () => operations.createGithubRepository(validRequest)])
  }
  if (validRequest.deployVercel) {
    steps.push(['deploy-vercel', () => operations.deployVercel(validRequest)])
  }
  if (validRequest.openCodex) {
    steps.push(['launch-codex', () => operations.launchCodex(validRequest)])
  }
  if (validRequest.startDevServer) {
    steps.push(['start-dev-server', () => operations.startDevServer(validRequest)])
  }

  const startIndex = options.startAt ? steps.findIndex(([stepId]) => stepId === options.startAt) : 0
  if (startIndex === -1) {
    return err(`선택하지 않은 단계는 재시도할 수 없습니다: ${options.startAt}`)
  }

  for (const [stepId, operation] of steps.slice(startIndex)) {
    // eslint-disable-next-line no-await-in-loop
    const stepResult = await runWorkflowStep(stepId, operation, progress)
    if (!stepResult.ok) {
      return stepResult
    }
  }

  return ok(undefined)
}
