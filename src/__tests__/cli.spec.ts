import {createRequire} from 'node:module'
import {beforeEach, describe, expect, it, vi} from 'vitest'

const require = createRequire(import.meta.url)
const packageJson = require('../../package.json') as {version: string}

const showWelcomeMock = vi.fn()
const setupGitHubMock = vi.fn()
const setupVercelMock = vi.fn()
const setupCodexMock = vi.fn()
const selectProjectNameMock = vi.fn()
const selectProjectDirMock = vi.fn()
const generateTemplateMock = vi.fn()
const installDependenciesMock = vi.fn()
const createGitHubRepositoryMock = vi.fn()
const deployVercelProjectMock = vi.fn()
const launchCodexAppMock = vi.fn()
const showCompleteMock = vi.fn()
const confirmMock = vi.fn()
const outroMock = vi.fn()
const runResetEnvironmentMock = vi.fn()

vi.mock('../steps/welcome.js', () => ({
  showWelcome: showWelcomeMock,
}))

vi.mock('../steps/setup-github.js', () => ({
  setupGitHub: setupGitHubMock,
}))

vi.mock('../steps/setup-vercel.js', () => ({
  setupVercel: setupVercelMock,
}))

vi.mock('../steps/setup-codex.js', () => ({
  setupCodex: setupCodexMock,
}))

vi.mock('../steps/select-project-dir.js', () => ({
  selectProjectDir: selectProjectDirMock,
}))

vi.mock('../steps/select-project-name.js', () => ({
  selectProjectName: selectProjectNameMock,
}))

vi.mock('../steps/generate-template.js', () => ({
  generateTemplate: generateTemplateMock,
}))

vi.mock('../steps/install-dependencies.js', () => ({
  installDependencies: installDependenciesMock,
}))

vi.mock('../steps/create-github-repository.js', () => ({
  createGitHubRepository: createGitHubRepositoryMock,
}))

vi.mock('../steps/deploy-vercel-project.js', () => ({
  deployVercelProject: deployVercelProjectMock,
}))

vi.mock('../steps/launch-codex-app.js', async () => {
  const actual = await vi.importActual<typeof import('../steps/launch-codex-app')>('../steps/launch-codex-app')
  return {
    ...actual,
    launchCodexApp: launchCodexAppMock,
  }
})

vi.mock('../steps/complete.js', () => ({
  showComplete: showCompleteMock,
}))

vi.mock('../commands/reset-environment.js', () => ({
  runResetEnvironment: runResetEnvironmentMock,
}))

vi.mock('@clack/prompts', async () => {
  const actual = await vi.importActual<typeof import('@clack/prompts')>('@clack/prompts')
  return {
    ...actual,
    confirm: confirmMock,
    outro: outroMock,
  }
})

describe('CLI program', () => {
  beforeEach(() => {
    showWelcomeMock.mockReset().mockResolvedValue(true)
    setupGitHubMock.mockReset().mockResolvedValue({name: 'GitHub', status: 'ready', message: 'ok'})
    setupVercelMock.mockReset().mockResolvedValue({name: 'Vercel', status: 'ready', message: 'ok'})
    setupCodexMock.mockReset().mockResolvedValue({name: 'Codex', status: 'ready', message: 'ok'})
    selectProjectNameMock.mockReset().mockResolvedValue('my-app')
    selectProjectDirMock.mockReset().mockResolvedValue('/repo')
    generateTemplateMock.mockReset().mockResolvedValue(undefined)
    installDependenciesMock.mockReset().mockResolvedValue(true)
    createGitHubRepositoryMock.mockReset().mockResolvedValue('bichikim/my-app')
    deployVercelProjectMock.mockReset().mockResolvedValue(undefined)
    launchCodexAppMock.mockReset().mockResolvedValue(true)
    showCompleteMock.mockReset()
    confirmMock.mockReset().mockResolvedValue(true)
    outroMock.mockReset()
    runResetEnvironmentMock.mockReset().mockResolvedValue(true)
    process.exitCode = undefined
  })

  it('runs all setup steps by default', async () => {
    const {runCli} = await import('../cli')

    await runCli(['node', 'create-vibe-start'])

    expect(setupGitHubMock).toHaveBeenCalledOnce()
    expect(setupVercelMock).toHaveBeenCalledOnce()
    expect(setupCodexMock).toHaveBeenCalledOnce()
    expect(confirmMock).toHaveBeenNthCalledWith(1, {
      message: '새 프로젝트를 만들까요?',
      initialValue: true,
    })
    expect(selectProjectNameMock).toHaveBeenCalledOnce()
    expect(selectProjectDirMock).toHaveBeenCalledWith({defaultDir: './my-app'})
    expect(generateTemplateMock).toHaveBeenCalledWith('/repo', {projectName: 'my-app'})
    expect(installDependenciesMock).toHaveBeenCalledWith('/repo')
    expect(confirmMock).toHaveBeenNthCalledWith(2, {
      message: 'GitHub에 저장소를 만들고 저장할까요?',
      initialValue: true,
    })
    expect(createGitHubRepositoryMock).toHaveBeenCalledWith('/repo', 'my-app')
    expect(confirmMock).toHaveBeenNthCalledWith(3, {
      message: 'Vercel에 프로젝트를 연결하고 배포할까요?',
      initialValue: true,
    })
    expect(deployVercelProjectMock).toHaveBeenCalledWith('/repo', 'my-app', 'bichikim/my-app')
    expect(launchCodexAppMock).toHaveBeenCalledWith('/repo', {name: 'Codex', status: 'ready', message: 'ok'}, true)
    expect(showCompleteMock).toHaveBeenCalledWith([
      {name: 'GitHub', status: 'ready', message: 'ok'},
      {name: 'Vercel', status: 'ready', message: 'ok'},
      {name: 'Codex', status: 'ready', message: 'Codex CLI 및 Codex 앱 사용 가능'},
    ])
  })

  it('uses the package version for --version output', async () => {
    const {createProgram} = await import('../cli')

    expect(createProgram().version()).toBe(packageJson.version)
  })

  it('honors skip options', async () => {
    const {runCli} = await import('../cli')

    await runCli(['node', 'create-vibe-start', '--skip-github', '--skip-codex'])

    expect(setupGitHubMock).not.toHaveBeenCalled()
    expect(setupVercelMock).toHaveBeenCalledOnce()
    expect(setupCodexMock).not.toHaveBeenCalled()
    expect(generateTemplateMock).toHaveBeenCalledWith('/repo', {projectName: 'my-app'})
    expect(installDependenciesMock).toHaveBeenCalledWith('/repo')
    expect(createGitHubRepositoryMock).not.toHaveBeenCalled()
    expect(deployVercelProjectMock).not.toHaveBeenCalled()
    expect(launchCodexAppMock).not.toHaveBeenCalled()
    expect(showCompleteMock).toHaveBeenCalledWith([{name: 'Vercel', status: 'ready', message: 'ok'}])
  })

  it('passes the project-dir option as the default project directory', async () => {
    const {runCli} = await import('../cli')

    await runCli(['node', 'create-vibe-start', '--project-dir', './test'])

    expect(selectProjectDirMock).toHaveBeenCalledWith({defaultDir: './test'})
    expect(generateTemplateMock).toHaveBeenCalledWith('/repo', {projectName: 'my-app'})
    expect(installDependenciesMock).toHaveBeenCalledWith('/repo')
  })

  it('stops after setup when project creation is declined', async () => {
    confirmMock.mockResolvedValueOnce(false)
    const {runCli} = await import('../cli')

    await runCli(['node', 'create-vibe-start'])

    expect(selectProjectNameMock).not.toHaveBeenCalled()
    expect(selectProjectDirMock).not.toHaveBeenCalled()
    expect(generateTemplateMock).not.toHaveBeenCalled()
    expect(installDependenciesMock).not.toHaveBeenCalled()
    expect(createGitHubRepositoryMock).not.toHaveBeenCalled()
    expect(launchCodexAppMock).not.toHaveBeenCalled()
    expect(showCompleteMock).toHaveBeenCalledWith([
      {name: 'GitHub', status: 'ready', message: 'ok'},
      {name: 'Vercel', status: 'ready', message: 'ok'},
      {name: 'Codex', status: 'ready', message: 'ok'},
    ])
  })

  it('skips GitHub repository creation when declined', async () => {
    confirmMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const {runCli} = await import('../cli')

    await runCli(['node', 'create-vibe-start'])

    expect(generateTemplateMock).toHaveBeenCalledWith('/repo', {projectName: 'my-app'})
    expect(installDependenciesMock).toHaveBeenCalledWith('/repo')
    expect(createGitHubRepositoryMock).not.toHaveBeenCalled()
    expect(deployVercelProjectMock).not.toHaveBeenCalled()
    expect(launchCodexAppMock).toHaveBeenCalledWith('/repo', {name: 'Codex', status: 'ready', message: 'ok'}, true)
    expect(showCompleteMock).toHaveBeenCalledWith([
      {name: 'GitHub', status: 'ready', message: 'ok'},
      {name: 'Vercel', status: 'ready', message: 'ok'},
      {name: 'Codex', status: 'ready', message: 'Codex CLI 및 Codex 앱 사용 가능'},
    ])
  })

  it('does not create a GitHub repository when GitHub setup is not ready', async () => {
    setupGitHubMock.mockResolvedValue({name: 'GitHub', status: 'skipped', message: 'skip'})
    const {runCli} = await import('../cli')

    await runCli(['node', 'create-vibe-start'])

    expect(generateTemplateMock).toHaveBeenCalledWith('/repo', {projectName: 'my-app'})
    expect(createGitHubRepositoryMock).not.toHaveBeenCalled()
    expect(deployVercelProjectMock).not.toHaveBeenCalled()
  })

  it('skips Vercel deployment when declined', async () => {
    confirmMock.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const {runCli} = await import('../cli')

    await runCli(['node', 'create-vibe-start'])

    expect(createGitHubRepositoryMock).toHaveBeenCalledWith('/repo', 'my-app')
    expect(confirmMock).toHaveBeenNthCalledWith(3, {
      message: 'Vercel에 프로젝트를 연결하고 배포할까요?',
      initialValue: true,
    })
    expect(deployVercelProjectMock).not.toHaveBeenCalled()
  })

  it('does not deploy to Vercel when Vercel setup is not ready', async () => {
    setupVercelMock.mockResolvedValue({name: 'Vercel', status: 'skipped', message: 'skip'})
    const {runCli} = await import('../cli')

    await runCli(['node', 'create-vibe-start'])

    expect(createGitHubRepositoryMock).toHaveBeenCalledWith('/repo', 'my-app')
    expect(deployVercelProjectMock).not.toHaveBeenCalled()
  })

  it('exits when project name selection is cancelled', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
    selectProjectNameMock.mockResolvedValue(null)
    const {runCli} = await import('../cli')

    await runCli(['node', 'create-vibe-start'])

    expect(outroMock).toHaveBeenCalledWith('프로젝트 준비를 취소했습니다.')
    expect(selectProjectDirMock).not.toHaveBeenCalled()
    expect(generateTemplateMock).not.toHaveBeenCalled()
    expect(installDependenciesMock).not.toHaveBeenCalled()
    expect(showCompleteMock).not.toHaveBeenCalled()
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('exits when project directory selection is declined', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
    selectProjectDirMock.mockResolvedValue(null)
    const {runCli} = await import('../cli')

    await runCli(['node', 'create-vibe-start'])

    expect(outroMock).toHaveBeenCalledWith('프로젝트 준비를 취소했습니다.')
    expect(generateTemplateMock).not.toHaveBeenCalled()
    expect(installDependenciesMock).not.toHaveBeenCalled()
    expect(showCompleteMock).not.toHaveBeenCalled()
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('exits early when the welcome prompt is declined', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
    showWelcomeMock.mockResolvedValue(false)
    const {runCli} = await import('../cli')

    await runCli(['node', 'create-vibe-start'])

    expect(outroMock).toHaveBeenCalledWith('준비가 필요할 때 다시 실행해주세요.')
    expect(setupGitHubMock).not.toHaveBeenCalled()
    expect(selectProjectDirMock).not.toHaveBeenCalled()
    expect(generateTemplateMock).not.toHaveBeenCalled()
    expect(installDependenciesMock).not.toHaveBeenCalled()
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('runs reset as a subcommand without starting onboarding', async () => {
    const {runCli} = await import('../cli')

    await runCli(['node', 'create-vibe-start', 'reset', '--yes', '--dry-run'])

    expect(runResetEnvironmentMock).toHaveBeenCalledWith({yes: true, dryRun: true})
    expect(showWelcomeMock).not.toHaveBeenCalled()
    expect(setupGitHubMock).not.toHaveBeenCalled()
    expect(setupVercelMock).not.toHaveBeenCalled()
    expect(setupCodexMock).not.toHaveBeenCalled()
    expect(selectProjectDirMock).not.toHaveBeenCalled()
    expect(generateTemplateMock).not.toHaveBeenCalled()
    expect(installDependenciesMock).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(0)
  })

  it('marks reset warnings as a failed process status', async () => {
    runResetEnvironmentMock.mockResolvedValue(false)
    const {runCli} = await import('../cli')

    await runCli(['node', 'create-vibe-start', 'reset', '--yes'])

    expect(runResetEnvironmentMock).toHaveBeenCalledWith({yes: true})
    expect(process.exitCode).toBe(1)
  })
})
