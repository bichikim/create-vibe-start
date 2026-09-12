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

function mockPrepareToolsAbsorption() {
  // Mirrors runWorkflowStep's temporary Phase 1→2 throw absorption.
  runCreateProjectWorkflowMock.mockImplementation(async (request, operations) => {
    try {
      await operations.prepareTools(request)
      return {ok: true, value: undefined}
    } catch (error) {
      return {ok: false, message: error instanceof Error ? error.message : String(error)}
    }
  })
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
      return {ok: true, value: undefined}
    })
  })

  it('returns err for invalid project requests before the workflow runs', async () => {
    const {runDesktopWorker} = await import('../desktop-worker')
    const request = {...baseRequest, projectName: 'My-App', createGithubRepository: true}

    await expect(runDesktopWorker(['node', 'desktop-worker', JSON.stringify(request)])).resolves.toEqual({
      ok: false,
      message: '대문자는 사용할 수 없습니다. `my-app`처럼 입력해주세요.',
    })
    expect(runCreateProjectWorkflowMock).not.toHaveBeenCalled()
  })

  it('requires a desktop project request payload', async () => {
    const {runDesktopWorker} = await import('../desktop-worker')
    await expect(runDesktopWorker(['node', 'desktop-worker'])).resolves.toEqual({
      ok: false,
      message: 'Desktop project request is required.',
    })
  })

  it('returns err for invalid JSON before parsing the request', async () => {
    const {runDesktopWorker} = await import('../desktop-worker')

    await expect(runDesktopWorker(['node', 'desktop-worker', '{'])).resolves.toEqual({
      ok: false,
      message: 'Desktop project request is invalid JSON.',
    })
  })

  it('parses a valid request and returns the workflow result', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const {runDesktopWorker} = await import('../desktop-worker')

    await expect(runDesktopWorker(['node', 'desktop-worker', JSON.stringify(baseRequest)])).resolves.toEqual({
      ok: true,
      value: {githubRepository: '', deploymentUrl: undefined},
    })

    expect(runCreateProjectWorkflowMock).toHaveBeenCalled()
    expect(generateTemplateMock).toHaveBeenCalledWith('/tmp/app', {projectName: 'my-app'}, '/templates')
    expect(installDependenciesMock).toHaveBeenCalledWith('/tmp/app')
    expect(writeSpy).not.toHaveBeenCalledWith('VIBE_RESULT:{"githubRepository":""}\n')
    writeSpy.mockRestore()
  })

  it('renders successful worker results through the CLI wrapper', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const {runDesktopWorkerCli} = await import('../desktop-worker')

    await runDesktopWorkerCli(['node', 'desktop-worker', JSON.stringify(baseRequest)])

    expect(writeSpy).toHaveBeenCalledWith('VIBE_RESULT:{"githubRepository":""}\n')
    writeSpy.mockRestore()
  })

  it('returns optional tool checks and workflow side effects', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const {runDesktopProjectWorkflow} = await import('../desktop-worker')

    await expect(
      runDesktopProjectWorkflow({
        ...baseRequest,
        createGithubRepository: true,
        deployVercel: true,
        openCodex: true,
        startDevServer: true,
        resumeFromStep: 'generate-template',
      }),
    ).resolves.toEqual({
      ok: true,
      value: {
        githubRepository: 'owner/repo',
        deploymentUrl: 'https://example.vercel.app',
      },
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
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining('VIBE_EVENT:'),
    )
    writeSpy.mockRestore()
  })

  it('resolves the GitHub repository when deploy runs before create fills it', async () => {
    createGitHubRepositoryMock.mockResolvedValue('')
    runCreateProjectWorkflowMock.mockImplementation(async (request, operations) => {
      await operations.deployVercel(request)
      return {ok: true, value: undefined}
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
    expect(result).toEqual({
      ok: true,
      value: {
        githubRepository: 'owner/repo',
        deploymentUrl: 'https://example.vercel.app',
      },
    })
  })

  it('returns err when a required command is missing', async () => {
    commandExistsMock.mockResolvedValue(false)
    mockPrepareToolsAbsorption()
    const {runDesktopProjectWorkflow} = await import('../desktop-worker')

    await expect(runDesktopProjectWorkflow(baseRequest)).resolves.toEqual({
      ok: false,
      message: 'Git이 필요합니다. 도구 준비 화면에서 Git을 설치해주세요.',
    })
  })

  it.each([
    ['pnpm', baseRequest, 'pnpm이 필요합니다. 도구 준비 화면에서 Node와 pnpm을 설치해주세요.'],
    [
      'gh',
      {...baseRequest, createGithubRepository: true},
      'GitHub CLI가 필요합니다. 도구 준비 화면에서 설치해주세요.',
    ],
    [
      'vercel',
      {...baseRequest, deployVercel: true},
      'Vercel CLI가 필요합니다. 도구 준비 화면에서 설치해주세요.',
    ],
    [
      'codex',
      {...baseRequest, openCodex: true},
      'Codex CLI가 필요합니다. 도구 준비 화면에서 설치해주세요.',
    ],
  ])('returns err when %s is missing', async (missingCommand, request, message) => {
    commandExistsMock.mockImplementation(async (command) => command !== missingCommand)
    mockPrepareToolsAbsorption()
    const {runDesktopProjectWorkflow} = await import('../desktop-worker')

    await expect(runDesktopProjectWorkflow(request)).resolves.toEqual({ok: false, message})
  })

  it('returns string failures from command checks', async () => {
    commandExistsMock.mockRejectedValue('command lookup failed')
    mockPrepareToolsAbsorption()
    const {runDesktopProjectWorkflow} = await import('../desktop-worker')

    await expect(runDesktopProjectWorkflow(baseRequest)).resolves.toEqual({
      ok: false,
      message: '알 수 없는 오류가 발생했습니다.',
    })
  })

  it('returns Error failures from command checks', async () => {
    commandExistsMock.mockRejectedValue(new Error('command lookup failed'))
    mockPrepareToolsAbsorption()
    const {runDesktopProjectWorkflow} = await import('../desktop-worker')

    await expect(runDesktopProjectWorkflow(baseRequest)).resolves.toEqual({
      ok: false,
      message: 'command lookup failed',
    })
  })

  it('returns string failures from optional tool checks', async () => {
    runCommandQuietlyMock.mockRejectedValue('authentication failed')
    mockPrepareToolsAbsorption()
    const {runDesktopProjectWorkflow} = await import('../desktop-worker')

    await expect(
      runDesktopProjectWorkflow({...baseRequest, createGithubRepository: true}),
    ).resolves.toEqual({ok: false, message: '알 수 없는 오류가 발생했습니다.'})
  })

  it('returns Error failures from optional tool checks', async () => {
    runCommandQuietlyMock.mockRejectedValue(new Error('authentication failed'))
    mockPrepareToolsAbsorption()
    const {runDesktopProjectWorkflow} = await import('../desktop-worker')

    await expect(
      runDesktopProjectWorkflow({...baseRequest, createGithubRepository: true}),
    ).resolves.toEqual({ok: false, message: 'authentication failed'})
  })

  it('returns string failures while resolving a GitHub repository', async () => {
    createGitHubRepositoryMock.mockResolvedValue('')
    runCommandQuietlyMock.mockImplementation(async (_command, args) => {
      if (args[0] === 'repo') {
        throw 'repository lookup failed'
      }
      return {stdout: 'owner/repo', stderr: '', exitCode: 0}
    })
    runCreateProjectWorkflowMock.mockImplementation(async (request, operations) => {
      await operations.createGithubRepository(request)
      return {ok: true, value: undefined}
    })
    const {runDesktopProjectWorkflow} = await import('../desktop-worker')

    await expect(
      runDesktopProjectWorkflow({...baseRequest, createGithubRepository: true}),
    ).resolves.toEqual({ok: false, message: '알 수 없는 오류가 발생했습니다.'})
  })

  it('returns Error failures while resolving a GitHub repository', async () => {
    createGitHubRepositoryMock.mockResolvedValue('')
    runCommandQuietlyMock.mockImplementation(async (_command, args) => {
      if (args[0] === 'repo') {
        throw new Error('repository lookup failed')
      }
      return {stdout: 'owner/repo', stderr: '', exitCode: 0}
    })
    runCreateProjectWorkflowMock.mockImplementation(async (request, operations) => {
      await operations.createGithubRepository(request)
      return {ok: true, value: undefined}
    })
    const {runDesktopProjectWorkflow} = await import('../desktop-worker')

    await expect(
      runDesktopProjectWorkflow({...baseRequest, createGithubRepository: true}),
    ).resolves.toEqual({ok: false, message: 'repository lookup failed'})
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

  it('emits worker errors for failed Results through the CLI wrapper', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    runCreateProjectWorkflowMock.mockResolvedValue({ok: false, message: 'boom'})
    const {runDesktopWorkerCli} = await import('../desktop-worker')

    await runDesktopWorkerCli(['node', 'desktop-worker', JSON.stringify(baseRequest)])

    expect(writeSpy).toHaveBeenCalledWith('VIBE_ERROR:{"message":"boom"}\n')
    expect(process.exitCode).toBe(1)
    writeSpy.mockRestore()
    process.exitCode = undefined
  })

  it('emits unexpected CLI safety-net failures', async () => {
    const writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementationOnce(() => {
        throw 'unexpected write failure'
      })
      .mockImplementation(() => true)
    const {runDesktopWorkerCli} = await import('../desktop-worker')

    await runDesktopWorkerCli(['node', 'desktop-worker', JSON.stringify(baseRequest)])

    expect(writeSpy).toHaveBeenLastCalledWith(
      'VIBE_ERROR:{"message":"알 수 없는 오류가 발생했습니다."}\n',
    )
    expect(process.exitCode).toBe(1)
    writeSpy.mockRestore()
    process.exitCode = undefined
  })

  it('emits unexpected Error failures through the CLI safety-net', async () => {
    const writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementationOnce(() => {
        throw new Error('unexpected write failure')
      })
      .mockImplementation(() => true)
    const {runDesktopWorkerCli} = await import('../desktop-worker')

    await runDesktopWorkerCli(['node', 'desktop-worker', JSON.stringify(baseRequest)])

    expect(writeSpy).toHaveBeenLastCalledWith(
      'VIBE_ERROR:{"message":"unexpected write failure"}\n',
    )
    expect(process.exitCode).toBe(1)
    writeSpy.mockRestore()
    process.exitCode = undefined
  })
})
