import {beforeEach, describe, expect, it, vi} from 'vitest'

const setupToolMock = vi.fn()

vi.mock('../setup-tool.js', () => ({
  setupTool: setupToolMock,
}))

describe('setupGitHub', () => {
  beforeEach(() => {
    setupToolMock.mockReset().mockResolvedValue({name: 'GitHub', status: 'ready', message: 'ok'})
  })

  it('configures GitHub CLI setup', async () => {
    const {setupGitHub} = await import('../setup-github.js')

    await setupGitHub()

    expect(setupToolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'GitHub',
        command: 'gh',
        commandLabel: 'gh (github)',
        versionArgs: ['--version'],
        authCheckArgs: ['auth', 'status'],
        loginArgs: ['auth', 'login'],
      }),
    )
  })
})
