import {EventEmitter} from 'node:events'
import {beforeEach, describe, expect, it, vi} from 'vitest'

const spawnMock = vi.hoisted(() => vi.fn())
const accessMock = vi.hoisted(() => vi.fn())
const rmMock = vi.hoisted(() => vi.fn())
const textMock = vi.hoisted(() => vi.fn())
const logMock = vi.hoisted(() => ({
  info: vi.fn(),
  message: vi.fn(),
  step: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}))

vi.mock('node:fs/promises', () => ({
  access: accessMock,
  rm: rmMock,
}))

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  isCancel: vi.fn(() => false),
  log: logMock,
  note: vi.fn(),
  outro: vi.fn(),
  text: textMock,
}))

describe('runResetEnvironment', () => {
  beforeEach(() => {
    spawnMock.mockReset()
    accessMock.mockReset().mockRejectedValue(new Error('missing'))
    rmMock.mockReset()
    textMock.mockReset().mockResolvedValue('reset')
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
    const {runResetEnvironment} = await import('../reset-environment.js')

    await expect(runResetEnvironment({yes: true})).resolves.toBe(false)

    expect(spawnMock).toHaveBeenCalledWith('vercel', ['logout', '--non-interactive'], {
      stdio: 'inherit',
      shell: false,
    })
    expect(spawnMock).toHaveBeenCalledWith('pnpm', ['remove', '-g', 'vercel'], {
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
  })

  it('prints reset steps without executing them in dry-run mode', async () => {
    const {runResetEnvironment} = await import('../reset-environment.js')

    await expect(runResetEnvironment({yes: true, dryRun: true})).resolves.toBe(true)

    expect(spawnMock).not.toHaveBeenCalled()
    expect(accessMock).not.toHaveBeenCalled()
    expect(rmMock).not.toHaveBeenCalled()
  })
})
