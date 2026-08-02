import {beforeEach, describe, expect, it, vi} from 'vitest'

const runCreateProjectWorkflowMock = vi.hoisted(() => vi.fn())
const commandExistsMock = vi.hoisted(() => vi.fn())
const runCommandQuietlyMock = vi.hoisted(() => vi.fn())
const runCommandInBackgroundMock = vi.hoisted(() => vi.fn())
const createGitHubRepositoryMock = vi.hoisted(() => vi.fn())
const deployVercelProjectMock = vi.hoisted(() => vi.fn())
const generateTemplateMock = vi.hoisted(() => vi.fn())
const installDependenciesMock = vi.hoisted(() => vi.fn())

vi.mock('../core/workflow', async () => {
  const actual = await vi.importActual<typeof import('../core/workflow')>('../core/workflow')
  return {
    ...actual,
    runCreateProjectWorkflow: runCreateProjectWorkflowMock,
  }
})

vi.mock('../steps/create-github-repository', () => ({createGitHubRepository: createGitHubRepositoryMock}))
vi.mock('../steps/deploy-vercel-project', () => ({deployVercelProject: deployVercelProjectMock}))
vi.mock('../steps/generate-template', () => ({generateTemplate: generateTemplateMock}))
vi.mock('../steps/install-dependencies', () => ({installDependencies: installDependenciesMock}))
vi.mock('../utils/command-exists', () => ({commandExists: commandExistsMock}))
vi.mock('../utils/run-command', () => ({
  runCommandInBackground: runCommandInBackgroundMock,
  runCommandQuietly: runCommandQuietlyMock,
}))

const baseRequest = {
  projectName: 'my-app',
  projectDir: '/tmp/app',
  createGithubRepository: false,
  deployVercel: false,
  openCodex: false,
  startDevServer: false,
  gitAuthorName: 'Vibe',
  gitAuthorEmail: 'vibe@example.com',
  templateDir: '/templates',
}

describe('desktop-worker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    commandExistsMock.mockResolvedValue(true)
    runCommandQuietlyMock.mockResolvedValue({stdout: 'owner/repo', stderr: '', exitCode: 0})
    createGitHubRepositoryMock.mockResolvedValue('owner/repo')
    deployVercelProjectMock.mockResolvedValue('https://example.vercel.app')
    generateTemplateMock.mockResolvedValue(undefined)
    installDependenciesMock.mockResolvedValue(true)
    runCreateProjectWorkflowMock.mockImplementation(async (request, operations, progress) => {
      progress.report({stepId: 'prepare-tools', status: 'running', message: '준비'})
      await operations.prepareTools(request)
      await operations.generateTemplate(request)
      await operations.installDependencies(request)
      if (request.createGithubRepository) {
        await operations.createGithubRepository(request)
      }
      if (request.deployVercel) {
        await operations.deployVercel(request)
      }
      if (request.openCodex) {
        await operations.launchCodex(request)
      }
      if (request.startDevServer) {
        await operations.startDevServer(request)
      }
    })
  })

  it('rejects invalid project requests before the workflow runs', async () => {
    const {runDesktopWorker} = await import('../desktop-worker')
    const request = {...baseRequest, projectName: 'My-App', createGithubRepository: true}

    await expect(runDesktopWorker(['node', 'desktop-worker', JSON.stringify(request)])).rejects.toThrow(
      '대문자는 사용할 수 없습니다. `my-app`처럼 입력해주세요.',
    )
    expect(runCreateProjectWorkflowMock).not.toHaveBeenCalled()
  })

  it('requires a desktop project request payload', async () => {
    const {runDesktopWorker} = await import('../desktop-worker')
    await expect(runDesktopWorker(['node', 'desktop-worker'])).rejects.toThrow(
      'Desktop project request is required.',
    )
  })

  it('parses a valid request and emits the workflow result', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const {runDesktopWorker} = await import('../desktop-worker')

    await runDesktopWorker(['node', 'desktop-worker', JSON.stringify(baseRequest)])

    expect(runCreateProjectWorkflowMock).toHaveBeenCalled()
    expect(generateTemplateMock).toHaveBeenCalledWith('/tmp/app', {projectName: 'my-app'}, '/templates')
    expect(installDependenciesMock).toHaveBeenCalledWith('/tmp/app')
    expect(writeSpy).toHaveBeenCalledWith('VIBE_RESULT:{"githubRepository":""}\n')
    writeSpy.mockRestore()
  })

  it('runs optional tool checks and workflow side effects', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const {runDesktopProjectWorkflow} = await import('../desktop-worker')

    const result = await runDesktopProjectWorkflow({
      ...baseRequest,
      createGithubRepository: true,
      deployVercel: true,
      openCodex: true,
      startDevServer: true,
      resumeFromStep: 'generate-template',
    })

    expect(commandExistsMock).toHaveBeenCalledWith('git')
    expect(commandExistsMock).toHaveBeenCalledWith('pnpm')
    expect(commandExistsMock).toHaveBeenCalledWith('gh')
    expect(commandExistsMock).toHaveBeenCalledWith('vercel')
    expect(commandExistsMock).toHaveBeenCalledWith('codex')
    expect(runCommandQuietlyMock).toHaveBeenCalledWith('gh', ['auth', 'status'])
    expect(runCommandQuietlyMock).toHaveBeenCalledWith('vercel', ['whoami'])
    expect(runCommandQuietlyMock).toHaveBeenCalledWith('codex', ['login', 'status'])
    expect(createGitHubRepositoryMock).toHaveBeenCalledWith('/tmp/app', 'my-app', {
      name: 'Vibe',
      email: 'vibe@example.com',
    })
    expect(deployVercelProjectMock).toHaveBeenCalledWith('/tmp/app', 'my-app', {
      githubRepository: 'owner/repo',
    })
    expect(runCommandQuietlyMock).toHaveBeenCalledWith('codex', ['app', '/tmp/app'])
    expect(runCommandInBackgroundMock).toHaveBeenCalledWith('pnpm', ['run', 'dev'], 'pnpm run dev', '/tmp/app')
    expect(result).toEqual({
      githubRepository: 'owner/repo',
      deploymentUrl: 'https://example.vercel.app',
    })
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining('VIBE_EVENT:'),
    )
    writeSpy.mockRestore()
  })

  it('resolves the GitHub repository when deploy runs before create fills it', async () => {
    createGitHubRepositoryMock.mockResolvedValue('')
    runCreateProjectWorkflowMock.mockImplementation(async (request, operations) => {
      await operations.deployVercel(request)
    })
    const {runDesktopProjectWorkflow} = await import('../desktop-worker')

    const result = await runDesktopProjectWorkflow({
      ...baseRequest,
      createGithubRepository: true,
      deployVercel: true,
    })

    expect(runCommandQuietlyMock).toHaveBeenCalledWith(
      'gh',
      ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'],
      '/tmp/app',
    )
    expect(result.githubRepository).toBe('owner/repo')
  })

  it('throws when a required command is missing', async () => {
    commandExistsMock.mockResolvedValue(false)
    runCreateProjectWorkflowMock.mockImplementation(async (request, operations) => {
      await operations.prepareTools(request)
    })
    const {runDesktopProjectWorkflow} = await import('../desktop-worker')

    await expect(runDesktopProjectWorkflow(baseRequest)).rejects.toThrow(
      'Git이 필요합니다. 도구 준비 화면에서 Git을 설치해주세요.',
    )
  })

  it('emits worker errors through the CLI wrapper', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const {runDesktopWorkerCli} = await import('../desktop-worker')

    await runDesktopWorkerCli(['node', 'desktop-worker'])

    expect(writeSpy).toHaveBeenCalledWith(
      'VIBE_ERROR:{"message":"Desktop project request is required."}\n',
    )
    expect(process.exitCode).toBe(1)
    writeSpy.mockRestore()
    process.exitCode = undefined
  })

  it('stringifies non-Error CLI failures', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    runCreateProjectWorkflowMock.mockRejectedValue('boom')
    const {runDesktopWorkerCli} = await import('../desktop-worker')

    await runDesktopWorkerCli(['node', 'desktop-worker', JSON.stringify(baseRequest)])

    expect(writeSpy).toHaveBeenCalledWith('VIBE_ERROR:{"message":"boom"}\n')
    expect(process.exitCode).toBe(1)
    writeSpy.mockRestore()
    process.exitCode = undefined
  })
})
