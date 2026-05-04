import {beforeEach, describe, expect, it, vi} from 'vitest'

const setupToolMock = vi.fn()

vi.mock('../setup-tool.js', () => ({
  setupTool: setupToolMock,
}))

describe('setupCodex', () => {
  beforeEach(() => {
    setupToolMock.mockReset().mockResolvedValue({name: 'Codex', status: 'ready', message: 'ok'})
  })

  it('configures Codex CLI setup', async () => {
    const {setupCodex} = await import('../setup-codex.js')

    await setupCodex()

    expect(setupToolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Codex',
        command: 'codex',
        versionArgs: ['--version'],
        authCheckArgs: ['--version'],
        loginArgs: [],
        loginLabel: 'codex',
      }),
    )
  })
})
