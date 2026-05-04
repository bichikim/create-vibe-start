import {beforeEach, describe, expect, it, vi} from 'vitest'

const showWelcomeMock = vi.fn()
const setupGitHubMock = vi.fn()
const setupVercelMock = vi.fn()
const setupCodexMock = vi.fn()
const showCompleteMock = vi.fn()
const outroMock = vi.fn()

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

vi.mock('../steps/complete.js', () => ({
  showComplete: showCompleteMock,
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
    showCompleteMock.mockReset()
    outroMock.mockReset()
  })

  it('runs all setup steps by default', async () => {
    const {runCli} = await import('../cli.js')

    await runCli(['node', 'create-vibe-start'])

    expect(setupGitHubMock).toHaveBeenCalledOnce()
    expect(setupVercelMock).toHaveBeenCalledOnce()
    expect(setupCodexMock).toHaveBeenCalledOnce()
    expect(showCompleteMock).toHaveBeenCalledWith([
      {name: 'GitHub', status: 'ready', message: 'ok'},
      {name: 'Vercel', status: 'ready', message: 'ok'},
      {name: 'Codex', status: 'ready', message: 'ok'},
    ])
  })

  it('honors skip options', async () => {
    const {runCli} = await import('../cli.js')

    await runCli(['node', 'create-vibe-start', '--skip-github', '--skip-codex'])

    expect(setupGitHubMock).not.toHaveBeenCalled()
    expect(setupVercelMock).toHaveBeenCalledOnce()
    expect(setupCodexMock).not.toHaveBeenCalled()
    expect(showCompleteMock).toHaveBeenCalledWith([{name: 'Vercel', status: 'ready', message: 'ok'}])
  })

  it('exits early when the welcome prompt is declined', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
    showWelcomeMock.mockResolvedValue(false)
    const {runCli} = await import('../cli.js')

    await runCli(['node', 'create-vibe-start'])

    expect(outroMock).toHaveBeenCalledWith('준비가 필요할 때 다시 실행해주세요.')
    expect(setupGitHubMock).not.toHaveBeenCalled()
    expect(exitSpy).toHaveBeenCalledWith(0)
  })
})
