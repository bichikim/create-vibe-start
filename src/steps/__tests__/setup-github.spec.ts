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
    const {setupGitHub} = await import('../setup-github')

    await setupGitHub()

    expect(setupToolMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        name: 'Git',
        command: 'git',
        versionArgs: ['--version'],
      }),
    )
    expect(setupToolMock).toHaveBeenNthCalledWith(
      2,
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

  it('skips GitHub CLI setup when Git is not ready', async () => {
    setupToolMock.mockResolvedValueOnce({name: 'Git', status: 'skipped', message: 'Git CLI 설치를 건너뜀'})
    const {setupGitHub} = await import('../setup-github')

    await expect(setupGitHub()).resolves.toEqual({
      name: 'GitHub',
      status: 'skipped',
      message: 'Git 준비 실패: Git CLI 설치를 건너뜀',
    })

    expect(setupToolMock).toHaveBeenCalledOnce()
  })
})
