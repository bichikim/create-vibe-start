import {beforeEach, describe, expect, it, vi} from 'vitest'

const textMock = vi.fn()

vi.mock('@clack/prompts', () => ({
  text: textMock,
  isCancel: (value: unknown) => value === 'cancel',
}))

describe('selectProjectName', () => {
  beforeEach(() => {
    textMock.mockReset().mockResolvedValue('my-app')
  })

  it('returns the trimmed project name', async () => {
    textMock.mockResolvedValue(' my-app ')
    const {selectProjectName} = await import('../select-project-name')

    await expect(selectProjectName()).resolves.toBe('my-app')
  })

  it('configures the project name prompt validation', async () => {
    const {selectProjectName} = await import('../select-project-name')

    await selectProjectName()

    expect(textMock).toHaveBeenCalledWith({
      message: '프로젝트 이름을 입력해주세요.',
      placeholder: 'my-vibe-app',
      validate: expect.any(Function),
    })

    const validate = textMock.mock.calls[0][0].validate as (value: string) => string | undefined
    expect(validate('')).toBe('프로젝트 이름을 입력해주세요.')
    expect(validate('My App')).toBe('소문자, 숫자, 하이픈만 사용할 수 있고 첫 글자는 소문자나 숫자여야 합니다.')
    expect(validate('my-app')).toBeUndefined()
  })

  it('returns null when the prompt is cancelled', async () => {
    textMock.mockResolvedValue('cancel')
    const {selectProjectName} = await import('../select-project-name')

    await expect(selectProjectName()).resolves.toBeNull()
  })
})
