import {EventEmitter} from 'node:events'
import {beforeEach, describe, expect, it, vi} from 'vitest'

const spawnMock = vi.hoisted(() => vi.fn())
const accessMock = vi.hoisted(() => vi.fn())
const rmMock = vi.hoisted(() => vi.fn())
const textMock = vi.hoisted(() => vi.fn())
const isCancelMock = vi.hoisted(() => vi.fn())
const commandExistsMock = vi.hoisted(() => vi.fn())
const outroMock = vi.hoisted(() => vi.fn())
const logMock = vi.hoisted(() => ({
  info: vi.fn(),
  message: vi.fn(),
  step: vi.fn(),
  warn: vi.fn(),
}))
const originalPlatform = process.platform
const originalAppData = process.env.APPDATA
const originalLocalAppData = process.env.LOCALAPPDATA
const originalXdgDataHome = process.env.XDG_DATA_HOME

function restoreEnvVar(name: 'APPDATA' | 'LOCALAPPDATA' | 'XDG_DATA_HOME', value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }
  process.env[name] = value
}

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}))

vi.mock('node:fs/promises', () => ({
  access: accessMock,
  rm: rmMock,
}))

vi.mock('../../utils/command-exists.js', () => ({
  commandExists: commandExistsMock,
}))

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  isCancel: isCancelMock,
  log: logMock,
  note: vi.fn(),
  outro: outroMock,
  text: textMock,
}))

describe('runResetEnvironment', () => {
  beforeEach(() => {
    vi.resetModules()
    Object.defineProperty(process, 'platform', {value: originalPlatform, configurable: true})
    restoreEnvVar('APPDATA', originalAppData)
    restoreEnvVar('LOCALAPPDATA', originalLocalAppData)
    restoreEnvVar('XDG_DATA_HOME', originalXdgDataHome)
    spawnMock.mockReset()
    accessMock.mockReset().mockRejectedValue(new Error('missing'))
    rmMock.mockReset()
    textMock.mockReset().mockResolvedValue('reset')
    isCancelMock.mockReset().mockReturnValue(false)
    commandExistsMock.mockReset().mockResolvedValue(true)
    outroMock.mockReset()
    logMock.info.mockReset()
    logMock.message.mockReset()
    logMock.step.mockReset()
    logMock.warn.mockReset()

    spawnMock.mockImplementation(() => {
      const child = new EventEmitter()
      process.nextTick(() => child.emit('error', new Error('not found')))
      return child
    })
  })

  it('keeps running later reset commands when earlier commands fail', async () => {
    const {runResetEnvironment} = await import('../reset-environment')

    await expect(runResetEnvironment({yes: true})).resolves.toBe(false)

    expect(spawnMock).toHaveBeenCalledWith('vercel', ['logout', '--non-interactive'], {
      stdio: 'inherit',
      shell: false,
    })
    expect(spawnMock).toHaveBeenCalledWith('pnpm', ['remove', '-g', 'vercel'], {
      stdio: 'inherit',
      shell: false,
    })
    expect(spawnMock).toHaveBeenCalledWith('npm', ['uninstall', '-g', 'vercel'], {
      stdio: 'inherit',
      shell: false,
    })
    expect(spawnMock).toHaveBeenCalledWith('codex', ['logout'], {
      stdio: 'inherit',
      shell: false,
    })
    expect(spawnMock).toHaveBeenCalledWith('pnpm', ['remove', '-g', '@openai/codex'], {
      stdio: 'inherit',
      shell: false,
    })
    expect(spawnMock).toHaveBeenCalledWith('npm', ['uninstall', '-g', '@openai/codex'], {
      stdio: 'inherit',
      shell: false,
    })
  })

  it('reports a warning when a reset command exits with a non-zero code', async () => {
    spawnMock.mockImplementation(() => {
      const child = new EventEmitter()
      process.nextTick(() => child.emit('exit', 7))
      return child
    })
    const {runResetEnvironment} = await import('../reset-environment')

    await expect(runResetEnvironment({yes: true})).resolves.toBe(false)

    expect(logMock.warn).toHaveBeenCalledWith(expect.stringContaining('종료 코드: 7'))
  })

  it('reports unknown when a reset command exits without a code', async () => {
    spawnMock.mockImplementation(() => {
      const child = new EventEmitter()
      process.nextTick(() => child.emit('exit', null))
      return child
    })
    const {runResetEnvironment} = await import('../reset-environment')

    await expect(runResetEnvironment({yes: true})).resolves.toBe(false)

    expect(logMock.warn).toHaveBeenCalledWith(expect.stringContaining('종료 코드: unknown'))
  })

  it('uses npm uninstall commands when pnpm is missing', async () => {
    commandExistsMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const {runResetEnvironment} = await import('../reset-environment')

    await expect(runResetEnvironment({yes: true})).resolves.toBe(false)

    expect(spawnMock).toHaveBeenCalledWith('npm', ['uninstall', '-g', 'vercel'], {
      stdio: 'inherit',
      shell: false,
    })
    expect(spawnMock).toHaveBeenCalledWith('npm', ['uninstall', '-g', '@openai/codex'], {
      stdio: 'inherit',
      shell: false,
    })
  })

  it('omits package-manager uninstall commands when pnpm and npm are missing', async () => {
    commandExistsMock.mockResolvedValue(false)
    const {runResetEnvironment} = await import('../reset-environment')

    await expect(runResetEnvironment({yes: true, dryRun: true})).resolves.toBe(true)

    expect(logMock.info).not.toHaveBeenCalledWith(expect.stringContaining('pnpm remove -g vercel'))
    expect(logMock.info).not.toHaveBeenCalledWith(expect.stringContaining('npm uninstall -g vercel'))
  })

  it('prints reset steps without executing them in dry-run mode', async () => {
    const {runResetEnvironment} = await import('../reset-environment')

    await expect(runResetEnvironment({yes: true, dryRun: true})).resolves.toBe(true)

    expect(spawnMock).not.toHaveBeenCalled()
    expect(accessMock).not.toHaveBeenCalled()
    expect(rmMock).not.toHaveBeenCalled()
  })

  it('does not tell users to rerun create-vibe-start after reset', async () => {
    const {runResetEnvironment} = await import('../reset-environment')

    await expect(runResetEnvironment({yes: true, dryRun: true})).resolves.toBe(true)

    expect(outroMock).toHaveBeenCalledWith('초기화가 완료되었습니다.')
  })

  it('returns success without running steps when the confirmation prompt is cancelled', async () => {
    textMock.mockResolvedValue('cancel')
    isCancelMock.mockReturnValue(true)
    const {runResetEnvironment} = await import('../reset-environment')

    await expect(runResetEnvironment()).resolves.toBe(true)

    expect(spawnMock).not.toHaveBeenCalled()
    expect(accessMock).not.toHaveBeenCalled()
    expect(rmMock).not.toHaveBeenCalled()
    expect(outroMock).toHaveBeenCalledWith('초기화를 취소했습니다.')
  })

  it('validates and rejects confirmation text other than reset', async () => {
    textMock.mockResolvedValue('nope')
    const {runResetEnvironment} = await import('../reset-environment')

    await expect(runResetEnvironment()).resolves.toBe(true)

    const prompt = textMock.mock.calls[0]?.[0] as {validate: (value: string) => string | undefined}
    expect(prompt.validate('reset')).toBeUndefined()
    expect(prompt.validate('nope')).toBe('reset을 입력해야 계속 진행합니다.')
    expect(spawnMock).not.toHaveBeenCalled()
    expect(outroMock).toHaveBeenCalledWith('초기화를 취소했습니다.')
  })

  it('runs after the user confirms reset in the prompt', async () => {
    textMock.mockResolvedValue('reset')
    const {runResetEnvironment} = await import('../reset-environment')

    await expect(runResetEnvironment({dryRun: true})).resolves.toBe(true)

    expect(logMock.info).toHaveBeenCalledWith(expect.stringContaining('[dry-run]'))
    expect(outroMock).toHaveBeenCalledWith('초기화가 완료되었습니다.')
  })

  it('removes existing config targets and completes successfully when commands exit cleanly', async () => {
    accessMock.mockResolvedValue(undefined)
    spawnMock.mockImplementation(() => {
      const child = new EventEmitter()
      process.nextTick(() => child.emit('exit', 0))
      return child
    })
    const {runResetEnvironment} = await import('../reset-environment')

    await expect(runResetEnvironment({yes: true})).resolves.toBe(true)

    expect(rmMock).toHaveBeenCalledWith(expect.stringContaining('.config/gh'), {force: true, recursive: true})
    expect(rmMock).toHaveBeenCalledWith(expect.stringContaining('.vercel'), {force: true, recursive: true})
    expect(rmMock).toHaveBeenCalledWith(expect.stringContaining('.codex/auth.json'), {
      force: true,
      recursive: true,
    })
    expect(outroMock).toHaveBeenCalledWith('초기화가 완료되었습니다.')
  })

  it('returns warnings when removing an existing target fails', async () => {
    accessMock.mockResolvedValue(undefined)
    rmMock.mockRejectedValue(new Error('permission denied'))
    spawnMock.mockImplementation(() => {
      const child = new EventEmitter()
      process.nextTick(() => child.emit('exit', 0))
      return child
    })
    const {runResetEnvironment} = await import('../reset-environment')

    await expect(runResetEnvironment({yes: true})).resolves.toBe(false)

    expect(logMock.warn).toHaveBeenCalledWith(
      expect.stringContaining('삭제 실패: permission denied'),
    )
    expect(outroMock).toHaveBeenCalledWith('초기화가 경고와 함께 완료되었습니다.')
  })

  it('formats non-Error remove failures', async () => {
    accessMock.mockResolvedValue(undefined)
    rmMock.mockRejectedValue('permission denied')
    spawnMock.mockImplementation(() => {
      const child = new EventEmitter()
      process.nextTick(() => child.emit('exit', 0))
      return child
    })
    const {runResetEnvironment} = await import('../reset-environment')

    await expect(runResetEnvironment({yes: true})).resolves.toBe(false)

    expect(logMock.warn).toHaveBeenCalledWith(expect.stringContaining('삭제 실패: permission denied'))
  })

  it('uses Windows reset commands and config paths on win32', async () => {
    Object.defineProperty(process, 'platform', {value: 'win32', configurable: true})
    process.env.APPDATA = 'C:\\Users\\me\\AppData\\Roaming'
    process.env.LOCALAPPDATA = 'C:\\Users\\me\\AppData\\Local'
    const {runResetEnvironment} = await import('../reset-environment')

    await expect(runResetEnvironment({yes: true, dryRun: true})).resolves.toBe(true)

    expect(logMock.info).toHaveBeenCalledWith('[dry-run] winget uninstall --id GitHub.cli')
    expect(logMock.info).toHaveBeenCalledWith(
      expect.stringContaining('C:\\Users\\me\\AppData\\Roaming'),
    )
    expect(logMock.info).toHaveBeenCalledWith(
      expect.stringContaining('C:\\Users\\me\\AppData\\Local'),
    )
  })

  it('uses macOS Homebrew and Vercel library paths on darwin', async () => {
    Object.defineProperty(process, 'platform', {value: 'darwin', configurable: true})
    const {runResetEnvironment} = await import('../reset-environment')

    await expect(runResetEnvironment({yes: true, dryRun: true})).resolves.toBe(true)

    expect(logMock.info).toHaveBeenCalledWith('[dry-run] brew uninstall gh')
    expect(logMock.info).toHaveBeenCalledWith(
      expect.stringContaining('Library/Application Support/com.vercel.cli'),
    )
    expect(logMock.info).toHaveBeenCalledWith(expect.stringContaining('Library/Caches/com.vercel.cli'))
  })

  it('uses the Vercel Linux data auth path and cache path outside macOS and Windows', async () => {
    Object.defineProperty(process, 'platform', {value: 'linux', configurable: true})
    delete process.env.XDG_DATA_HOME
    const {runResetEnvironment} = await import('../reset-environment')

    await expect(runResetEnvironment({yes: true, dryRun: true})).resolves.toBe(true)

    expect(logMock.info).toHaveBeenCalledWith(expect.stringContaining('.local/share/com.vercel.cli'))
    expect(logMock.info).toHaveBeenCalledWith(expect.stringContaining('.cache/com.vercel.cli'))
  })

  it('uses XDG_DATA_HOME for the Vercel Linux auth path when set', async () => {
    Object.defineProperty(process, 'platform', {value: 'linux', configurable: true})
    process.env.XDG_DATA_HOME = '/xdg-data'
    const {runResetEnvironment} = await import('../reset-environment')

    await expect(runResetEnvironment({yes: true, dryRun: true})).resolves.toBe(true)

    expect(logMock.info).toHaveBeenCalledWith(expect.stringContaining('/xdg-data/com.vercel.cli'))
  })
})
