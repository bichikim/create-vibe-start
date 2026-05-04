import {beforeEach, describe, expect, it, vi} from 'vitest'

const setupToolMock = vi.fn()

vi.mock('../setup-tool.js', () => ({
  setupTool: setupToolMock,
}))

describe('setupVercel', () => {
  beforeEach(() => {
    setupToolMock.mockReset().mockResolvedValue({name: 'Vercel', status: 'ready', message: 'ok'})
  })

  it('configures Vercel CLI setup', async () => {
    const {setupVercel} = await import('../setup-vercel.js')

    await setupVercel()

    expect(setupToolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Vercel',
        command: 'vercel',
        versionArgs: ['--version'],
        authCheckArgs: ['whoami'],
        loginArgs: ['login'],
      }),
    )
  })
})
