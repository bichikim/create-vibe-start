import {beforeEach, describe, expect, it, vi} from 'vitest'

const setupToolMock = vi.fn()
const commandExistsMock = vi.fn()

vi.mock('../setup-tool.js', () => ({
  setupTool: setupToolMock,
}))

vi.mock('../../utils/command-exists.js', () => ({
  commandExists: commandExistsMock,
}))

describe('setupVercel', () => {
  beforeEach(() => {
    vi.resetModules()
    setupToolMock.mockReset().mockResolvedValue({name: 'Vercel', status: 'ready', message: 'ok'})
    commandExistsMock.mockReset().mockResolvedValue(false)
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
        install: {
          macos: {
            command: 'npm',
            args: ['install', '-g', 'vercel'],
            label: 'npm install -g vercel',
          },
          windows: {
            command: 'npm',
            args: ['install', '-g', 'vercel'],
            label: 'npm install -g vercel',
          },
          linux: {
            command: 'npm',
            args: ['install', '-g', 'vercel'],
            label: 'npm install -g vercel',
          },
        },
      }),
    )
  })

  it('uses pnpm for installation when pnpm exists', async () => {
    commandExistsMock.mockResolvedValue(true)
    const {setupVercel} = await import('../setup-vercel.js')

    await setupVercel()

    expect(setupToolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        install: {
          macos: {
            command: 'pnpm',
            args: ['add', '-g', 'vercel'],
            label: 'pnpm add -g vercel',
          },
          windows: {
            command: 'pnpm',
            args: ['add', '-g', 'vercel'],
            label: 'pnpm add -g vercel',
          },
          linux: {
            command: 'pnpm',
            args: ['add', '-g', 'vercel'],
            label: 'pnpm add -g vercel',
          },
        },
      }),
    )
  })
})
