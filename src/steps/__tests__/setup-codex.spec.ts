import {beforeEach, describe, expect, it, vi} from 'vitest'

const setupToolMock = vi.fn()
const commandExistsMock = vi.fn()

vi.mock('../setup-tool.js', () => ({
  setupTool: setupToolMock,
}))

vi.mock('../../utils/command-exists.js', () => ({
  commandExists: commandExistsMock,
}))

describe('setupCodex', () => {
  beforeEach(() => {
    vi.resetModules()
    setupToolMock.mockReset().mockResolvedValue({name: 'Codex', status: 'ready', message: 'ok'})
    commandExistsMock.mockReset().mockResolvedValue(false)
  })

  it('configures Codex CLI setup', async () => {
    const {setupCodex} = await import('../setup-codex')

    await setupCodex()

    expect(setupToolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Codex',
        command: 'codex',
        versionArgs: ['--version'],
        authCheckArgs: ['login', 'status'],
        loginArgs: ['login'],
        install: {
          macos: {
            command: 'npm',
            args: ['install', '-g', '@openai/codex'],
            label: 'npm install -g @openai/codex',
          },
          windows: {
            command: 'npm',
            args: ['install', '-g', '@openai/codex'],
            label: 'npm install -g @openai/codex',
          },
          linux: {
            command: 'npm',
            args: ['install', '-g', '@openai/codex'],
            label: 'npm install -g @openai/codex',
          },
        },
      }),
    )
  })

  it('uses pnpm for installation when pnpm exists', async () => {
    commandExistsMock.mockResolvedValue(true)
    const {setupCodex} = await import('../setup-codex')

    await setupCodex()

    expect(setupToolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        install: {
          macos: {
            command: 'pnpm',
            args: ['add', '-g', '@openai/codex'],
            label: 'pnpm add -g @openai/codex',
          },
          windows: {
            command: 'pnpm',
            args: ['add', '-g', '@openai/codex'],
            label: 'pnpm add -g @openai/codex',
          },
          linux: {
            command: 'pnpm',
            args: ['add', '-g', '@openai/codex'],
            label: 'pnpm add -g @openai/codex',
          },
        },
      }),
    )
  })
})
