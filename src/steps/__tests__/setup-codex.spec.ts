import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const setupToolMock = vi.fn()
const commandExistsMock = vi.fn()
const runCommandMock = vi.fn()
const runCommandQuietlyMock = vi.fn()
const logWarnMock = vi.fn()
let homeDir: string
let originalHome: string | undefined

vi.mock('../setup-tool.js', () => ({
  setupTool: setupToolMock,
}))

vi.mock('../../utils/command-exists.js', () => ({
  commandExists: commandExistsMock,
}))

vi.mock('../../utils/run-command.js', () => ({
  runCommand: runCommandMock,
  runCommandQuietly: runCommandQuietlyMock,
}))

vi.mock('@clack/prompts', () => ({
  log: {
    warn: logWarnMock,
  },
}))

describe('setupCodex', () => {
  beforeEach(async () => {
    vi.resetModules()
    originalHome = process.env.HOME
    homeDir = await mkdtemp(path.join(os.tmpdir(), 'setup-codex-'))
    process.env.HOME = homeDir
    setupToolMock.mockReset().mockResolvedValue({name: 'Codex', status: 'skipped', message: 'ok'})
    commandExistsMock.mockReset().mockResolvedValue(false)
    runCommandMock.mockReset().mockResolvedValue(undefined)
    runCommandQuietlyMock.mockReset().mockResolvedValue({stdout: '', stderr: ''})
    logWarnMock.mockReset()
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

  it('adds the official marketplace and enables default plugins when Codex is ready', async () => {
    setupToolMock.mockResolvedValue({name: 'Codex', status: 'ready', message: 'ok'})
    const {setupCodex} = await import('../setup-codex')

    await setupCodex()

    expect(runCommandQuietlyMock).toHaveBeenCalledWith('codex', ['plugin', 'marketplace', 'list'])
    expect(runCommandMock).toHaveBeenCalledWith(
      'codex',
      ['plugin', 'marketplace', 'add', 'openai/plugins'],
      'codex plugin marketplace add openai/plugins',
    )

    const config = await readFile(path.join(homeDir, '.codex', 'config.toml'), 'utf8')
    expect(config).toContain('[plugins."github@openai-curated"]\nenabled = true')
    expect(config).toContain('[plugins."vercel@openai-curated"]\nenabled = true')
    expect(config).toContain('[plugins."openai-developers@openai-curated"]\nenabled = true')
    expect(config).toContain('[plugins."build-web-apps@openai-curated"]\nenabled = true')
  })

  it('skips adding the official marketplace when it already exists', async () => {
    setupToolMock.mockResolvedValue({name: 'Codex', status: 'ready', message: 'ok'})
    runCommandQuietlyMock.mockResolvedValue({stdout: 'openai-curated  openai/plugins', stderr: ''})
    const {setupCodex} = await import('../setup-codex')

    await setupCodex()

    expect(runCommandMock).not.toHaveBeenCalled()

    const config = await readFile(path.join(homeDir, '.codex', 'config.toml'), 'utf8')
    expect(config).toContain('[plugins."github@openai-curated"]\nenabled = true')
  })

  it('adds the official marketplace when listing marketplaces fails', async () => {
    setupToolMock.mockResolvedValue({name: 'Codex', status: 'ready', message: 'ok'})
    runCommandQuietlyMock.mockRejectedValue(new Error('list failed'))
    const {setupCodex} = await import('../setup-codex')

    await setupCodex()

    expect(runCommandMock).toHaveBeenCalledWith(
      'codex',
      ['plugin', 'marketplace', 'add', 'openai/plugins'],
      'codex plugin marketplace add openai/plugins',
    )
  })

  it('warns without failing when default plugin setup fails', async () => {
    setupToolMock.mockResolvedValue({name: 'Codex', status: 'ready', message: 'ok'})
    runCommandMock.mockRejectedValue(new Error('marketplace unavailable'))
    const {setupCodex} = await import('../setup-codex')

    await expect(setupCodex()).resolves.toEqual({name: 'Codex', status: 'ready', message: 'ok'})

    expect(logWarnMock).toHaveBeenCalledWith('Codex 기본 플러그인 설치 실패: marketplace unavailable')
  })

  it('formats non-Error default plugin setup failures', async () => {
    setupToolMock.mockResolvedValue({name: 'Codex', status: 'ready', message: 'ok'})
    runCommandMock.mockRejectedValue('marketplace unavailable')
    const {setupCodex} = await import('../setup-codex')

    await expect(setupCodex()).resolves.toEqual({name: 'Codex', status: 'ready', message: 'ok'})

    expect(logWarnMock).toHaveBeenCalledWith('Codex 기본 플러그인 설치 실패: marketplace unavailable')
  })

  it('does not duplicate existing plugin config blocks', async () => {
    const configPath = path.join(homeDir, '.codex', 'config.toml')
    await mkdir(path.dirname(configPath), {recursive: true})
    await writeFile(configPath, '[plugins."github@openai-curated"]\nenabled = true\n')
    const {enableDefaultPlugins} = await import('../setup-codex')

    await enableDefaultPlugins(configPath)

    const config = await readFile(configPath, 'utf8')
    expect(config.match(/\[plugins\."github@openai-curated"\]/g)).toHaveLength(1)
    expect(config).toContain('[plugins."vercel@openai-curated"]\nenabled = true')
  })

  it('does not rewrite the config when all default plugin blocks already exist', async () => {
    const configPath = path.join(homeDir, '.codex', 'config.toml')
    await mkdir(path.dirname(configPath), {recursive: true})
    await writeFile(
      configPath,
      [
        '[plugins."github@openai-curated"]',
        'enabled = true',
        '[plugins."vercel@openai-curated"]',
        'enabled = true',
        '[plugins."openai-developers@openai-curated"]',
        'enabled = true',
        '[plugins."build-web-apps@openai-curated"]',
        'enabled = true',
      ].join('\n'),
    )
    const {enableDefaultPlugins} = await import('../setup-codex')

    await enableDefaultPlugins(configPath)

    const config = await readFile(configPath, 'utf8')
    expect(config.match(/\[plugins\./g)).toHaveLength(4)
  })

  it('rethrows non-missing config read errors', async () => {
    const configPath = path.join(homeDir, 'config-as-directory')
    await mkdir(configPath)
    const {enableDefaultPlugins} = await import('../setup-codex')

    await expect(enableDefaultPlugins(configPath)).rejects.toThrow()
  })

  afterEach(async () => {
    if (originalHome === undefined) {
      delete process.env.HOME
    } else {
      process.env.HOME = originalHome
    }
    await rm(homeDir, {recursive: true, force: true})
  })
})
