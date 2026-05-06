import {createRequire} from 'node:module'
import {beforeEach, describe, expect, it, vi} from 'vitest'

const require = createRequire(import.meta.url)
const packageJson = require('../../package.json') as {version: string}

const showWelcomeMock = vi.fn()
const setupGitHubMock = vi.fn()
const setupVercelMock = vi.fn()
const setupCodexMock = vi.fn()
const selectProjectDirMock = vi.fn()
const generateTemplateMock = vi.fn()
const showCompleteMock = vi.fn()
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

vi.mock('../steps/generate-template.js', () => ({
  generateTemplate: generateTemplateMock,
}))

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
    outro: outroMock,
  }
})

describe('CLI program', () => {
  beforeEach(() => {
    showWelcomeMock.mockReset().mockResolvedValue(true)
    setupGitHubMock.mockReset().mockResolvedValue({name: 'GitHub', status: 'ready', message: 'ok'})
    setupVercelMock.mockReset().mockResolvedValue({name: 'Vercel', status: 'ready', message: 'ok'})
    setupCodexMock.mockReset().mockResolvedValue({name: 'Codex', status: 'ready', message: 'ok'})
    selectProjectDirMock.mockReset().mockResolvedValue('/repo')
    generateTemplateMock.mockReset().mockResolvedValue(undefined)
    showCompleteMock.mockReset()
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
    expect(selectProjectDirMock).toHaveBeenCalledWith({defaultDir: '.'})
    expect(generateTemplateMock).toHaveBeenCalledWith('/repo')
    expect(showCompleteMock).toHaveBeenCalledWith([
      {name: 'GitHub', status: 'ready', message: 'ok'},
      {name: 'Vercel', status: 'ready', message: 'ok'},
      {name: 'Codex', status: 'ready', message: 'ok'},
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
    expect(generateTemplateMock).toHaveBeenCalledWith('/repo')
    expect(showCompleteMock).toHaveBeenCalledWith([{name: 'Vercel', status: 'ready', message: 'ok'}])
  })

  it('passes the project-dir option as the default project directory', async () => {
    const {runCli} = await import('../cli')

    await runCli(['node', 'create-vibe-start', '--project-dir', './test'])

    expect(selectProjectDirMock).toHaveBeenCalledWith({defaultDir: './test'})
    expect(generateTemplateMock).toHaveBeenCalledWith('/repo')
  })

  it('exits when project directory selection is declined', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
    selectProjectDirMock.mockResolvedValue(null)
    const {runCli} = await import('../cli')

    await runCli(['node', 'create-vibe-start'])

    expect(outroMock).toHaveBeenCalledWith('프로젝트 준비를 취소했습니다.')
    expect(generateTemplateMock).not.toHaveBeenCalled()
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
