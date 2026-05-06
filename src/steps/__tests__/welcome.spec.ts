import {beforeEach, describe, expect, it, vi} from 'vitest'

const confirmMock = vi.fn()
const introMock = vi.fn()
const noteMock = vi.fn()

vi.mock('@clack/prompts', () => ({
  confirm: confirmMock,
  intro: introMock,
  note: noteMock,
}))

describe('showWelcome', () => {
  beforeEach(() => {
    confirmMock.mockReset()
    introMock.mockReset()
    noteMock.mockReset()
  })

  it('shows onboarding copy and asks to proceed', async () => {
    confirmMock.mockResolvedValue(true)
    const {showWelcome} = await import('../welcome')

    await expect(showWelcome()).resolves.toBe(true)

    expect(introMock).toHaveBeenCalledWith('create-vibe-start')
    expect(noteMock).toHaveBeenCalledWith(
      expect.stringContaining('GitHub, Vercel, Codex CLI'),
      'AI 웹앱 개발 시작 전 준비',
    )
    expect(confirmMock).toHaveBeenCalledWith({
      message: '시작할까요?',
      initialValue: true,
    })
  })
})
