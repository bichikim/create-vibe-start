import type {ToolId, WorkflowEvent, WorkflowStepId} from '../../src/core/workflow'
import {projectNameValidationError} from '../../src/core/project-name'

export type StepView = WorkflowEvent & {expanded: boolean}

export const workflowStepOrder: WorkflowStepId[] = [
  'prepare-tools',
  'generate-template',
  'install-dependencies',
  'create-github-repository',
  'deploy-vercel',
  'launch-codex',
  'start-dev-server',
]

export type ToolReadiness = {
  tool: ToolId
  installed: boolean
  authenticated: boolean | null
}

export type AuthenticationPrompt = {
  url?: string
  code?: string
}

export function requiredToolIds(options: {
  createGithubRepository: boolean
  deployVercel: boolean
  openCodex: boolean
}): ToolId[] {
  return [
    'git',
    'node',
    'pnpm',
    ...(options.createGithubRepository ? (['gh'] as const) : []),
    ...(options.deployVercel ? (['vercel'] as const) : []),
    ...(options.openCodex ? (['codex'] as const) : []),
  ]
}

export function areRequiredToolsReady(required: ToolId[], tools: ToolReadiness[]) {
  return Boolean(
    required.every((tool) => {
      const status = tools.find((candidate) => candidate.tool === tool)
      return status?.installed && status.authenticated !== false
    }),
  )
}

export function canStartProject(input: {
  running: boolean
  projectName: string
  parentDir: string
  createGithubRepository: boolean
  gitAuthorName: string
  gitAuthorEmail: string
  toolsReady: boolean
}) {
  return Boolean(
    !input.running &&
    !projectNameValidationError(input.projectName) &&
    input.parentDir.trim() &&
    (!input.createGithubRepository || (input.gitAuthorName.trim() && input.gitAuthorEmail.includes('@'))) &&
    input.toolsReady,
  )
}

export function applyWorkflowEvent(steps: StepView[], event: WorkflowEvent): StepView[] {
  const index = steps.findIndex(({stepId}) => stepId === event.stepId)
  if (index === -1) {
    return [...steps, {...event, expanded: event.status === 'failed'}].sort(
      (left, right) => workflowStepOrder.indexOf(left.stepId) - workflowStepOrder.indexOf(right.stepId),
    )
  }

  return steps.map((step, stepIndex) => {
    return stepIndex === index ? {...step, ...event, expanded: step.expanded || event.status === 'failed'} : step
  })
}

export function redactLog(value: string) {
  return value
    .replace(/(?<prefix>Bearer\s+)[A-Za-z0-9._~+/-]+/giu, '$<prefix>[REDACTED]')
    .replace(/(?<prefix>(?:TOKEN|SECRET|PASSWORD)\s*[=:]\s*)[^\s]+/giu, '$<prefix>[REDACTED]')
}

export function parseAuthenticationPrompt(value: string): AuthenticationPrompt | null {
  const url = value.match(/https:\/\/(?:github\.com|vercel\.com|openai\.com|auth\.openai\.com)\/[^\s]+/iu)?.[0]
  const code = value.match(/(?:code|코드)\s*[:：]?\s*(?<code>[A-Z0-9-]{4,})/iu)?.groups?.code
  return url || code ? {url, code} : null
}

/** Normalizes a generated Vercel URL so it matches the opener scope, including its root slash. */
export function normalizeDeploymentUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.vercel.app')) {
    throw new Error('허용되지 않은 배포 URL입니다.')
  }
  return url.toString()
}
