import {describe, expect, it, vi} from 'vitest'
import {
  type CreateProjectRequest,
  type ProgressPort,
  type ProjectWorkflowOperations,
  runCreateProjectWorkflow,
  runWorkflowStep,
  validateCreateProjectRequest,
  WorkflowCancelledError,
  type WorkflowEvent,
} from '../workflow'

const request: CreateProjectRequest = {
  projectName: 'my-app',
  projectDir: '/tmp/my-app',
  createGithubRepository: true,
  deployVercel: true,
  openCodex: true,
  startDevServer: true,
}

function makeOperations() {
  return {
    prepareTools: vi.fn().mockResolvedValue(undefined),
    generateTemplate: vi.fn().mockResolvedValue(undefined),
    installDependencies: vi.fn().mockResolvedValue(undefined),
    createGithubRepository: vi.fn().mockResolvedValue(undefined),
    deployVercel: vi.fn().mockResolvedValue(undefined),
    launchCodex: vi.fn().mockResolvedValue(undefined),
    startDevServer: vi.fn().mockResolvedValue(undefined),
  } satisfies ProjectWorkflowOperations
}

function makeProgress() {
  const events: WorkflowEvent[] = []
  const progress: ProgressPort = {
    report: (event) => {
      events.push(event)
    },
  }
  return {events, progress}
}

describe('validateCreateProjectRequest', () => {
  it('rejects missing project names and directories', () => {
    expect(() => validateCreateProjectRequest({...request, projectName: ' '})).toThrow('프로젝트 이름을 입력해주세요.')
    expect(() => validateCreateProjectRequest({...request, projectDir: ' '})).toThrow('프로젝트 폴더를 선택해주세요.')
  })

  it('uses the shared project-name rules', () => {
    expect(() => validateCreateProjectRequest({...request, projectName: 'My-app'})).toThrow(
      '대문자는 사용할 수 없습니다. `my-app`처럼 입력해주세요.',
    )
  })

  it('requires GitHub when Vercel deployment is selected', () => {
    expect(() => validateCreateProjectRequest({...request, createGithubRepository: false, deployVercel: true})).toThrow(
      'Vercel 배포에는 GitHub 저장소 생성이 필요합니다.',
    )
  })
})

describe('runCreateProjectWorkflow', () => {
  it('rejects invalid names before starting any operation', async () => {
    const operations = makeOperations()
    const {events, progress} = makeProgress()

    await expect(
      runCreateProjectWorkflow({...request, projectName: 'bad---name'}, operations, progress),
    ).rejects.toThrow('프로젝트 이름에는 ---를 사용할 수 없습니다.')

    expect(Object.values(operations).every((operation) => operation.mock.calls.length === 0)).toBe(true)
    expect(events).toEqual([])
  })

  it('runs selected steps in order and reports progress', async () => {
    const operations = makeOperations()
    const {events, progress} = makeProgress()

    await runCreateProjectWorkflow(request, operations, progress)

    expect(Object.values(operations).every((operation) => operation.mock.calls.length === 1)).toBe(true)
    expect(events.map(({stepId, status}) => `${stepId}:${status}`)).toEqual([
      'prepare-tools:running',
      'prepare-tools:succeeded',
      'generate-template:running',
      'generate-template:succeeded',
      'install-dependencies:running',
      'install-dependencies:succeeded',
      'create-github-repository:running',
      'create-github-repository:succeeded',
      'deploy-vercel:running',
      'deploy-vercel:succeeded',
      'launch-codex:running',
      'launch-codex:succeeded',
      'start-dev-server:running',
      'start-dev-server:succeeded',
    ])
  })

  it('skips unselected optional steps', async () => {
    const operations = makeOperations()
    const {progress} = makeProgress()

    await runCreateProjectWorkflow(
      {
        ...request,
        createGithubRepository: false,
        deployVercel: false,
        openCodex: false,
        startDevServer: false,
      },
      operations,
      progress,
    )

    expect(operations.prepareTools).toHaveBeenCalledOnce()
    expect(operations.generateTemplate).toHaveBeenCalledOnce()
    expect(operations.installDependencies).toHaveBeenCalledOnce()
    expect(operations.createGithubRepository).not.toHaveBeenCalled()
    expect(operations.deployVercel).not.toHaveBeenCalled()
    expect(operations.launchCodex).not.toHaveBeenCalled()
    expect(operations.startDevServer).not.toHaveBeenCalled()
  })

  it('retries from a failed step without rerunning completed steps', async () => {
    const operations = makeOperations()
    const {events, progress} = makeProgress()

    await runCreateProjectWorkflow(request, operations, progress, {startAt: 'deploy-vercel'})

    expect(operations.prepareTools).not.toHaveBeenCalled()
    expect(operations.createGithubRepository).not.toHaveBeenCalled()
    expect(operations.deployVercel).toHaveBeenCalledOnce()
    expect(operations.launchCodex).toHaveBeenCalledOnce()
    expect(events[0]).toMatchObject({stepId: 'deploy-vercel', status: 'running'})
  })

  it('rejects retrying a step excluded by the request', async () => {
    const operations = makeOperations()
    const {progress} = makeProgress()

    await expect(
      runCreateProjectWorkflow({...request, openCodex: false}, operations, progress, {startAt: 'launch-codex'}),
    ).rejects.toThrow('선택하지 않은 단계는 재시도할 수 없습니다')
  })
})

describe('runWorkflowStep', () => {
  it('reports failures and rethrows them', async () => {
    const {events, progress} = makeProgress()

    await expect(
      runWorkflowStep('generate-template', () => Promise.reject(new Error('broken')), progress),
    ).rejects.toThrow('broken')
    expect(events.at(-1)).toMatchObject({status: 'failed', detail: 'broken'})
  })

  it('reports user cancellation separately', async () => {
    const {events, progress} = makeProgress()

    await expect(
      runWorkflowStep('generate-template', () => Promise.reject(new WorkflowCancelledError()), progress),
    ).rejects.toBeInstanceOf(WorkflowCancelledError)
    expect(events.at(-1)).toMatchObject({status: 'cancelled'})
  })
})
