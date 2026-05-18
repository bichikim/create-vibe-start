import {beforeEach, describe, expect, it, vi} from 'vitest'

const existsSyncMock = vi.fn()
const statSyncMock = vi.fn()
const textMock = vi.fn()
const confirmMock = vi.fn()
const logErrorMock = vi.fn()

vi.mock('node:fs', () => ({
  existsSync: existsSyncMock,
  statSync: statSyncMock,
}))

vi.mock('@clack/prompts', () => ({
  text: textMock,
  confirm: confirmMock,
  isCancel: (value: unknown) => value === 'cancel',
  log: {
    error: logErrorMock,
  },
}))

describe('selectProjectDir', () => {
  beforeEach(() => {
    existsSyncMock.mockReset().mockReturnValue(false)
    statSyncMock.mockReset().mockReturnValue({isDirectory: () => true})
    textMock.mockReset().mockResolvedValue('app')
    confirmMock.mockReset().mockResolvedValue(true)
    logErrorMock.mockReset()
  })

  it('resolves the entered project directory from the base directory', async () => {
    const {selectProjectDir} = await import('../select-project-dir')

    await expect(selectProjectDir({baseDir: '/workspace', defaultDir: './test'})).resolves.toBe('/workspace/app')

    expect(textMock).toHaveBeenCalledWith({
      message: '프로젝트 작업 폴더를 입력해주세요.',
      placeholder: './test',
      initialValue: './test',
    })
    expect(confirmMock).not.toHaveBeenCalled()
  })

  it('uses the default directory when the answer is empty', async () => {
    textMock.mockResolvedValue('   ')
    const {selectProjectDir} = await import('../select-project-dir')

    await expect(selectProjectDir({baseDir: '/workspace', defaultDir: './test'})).resolves.toBe('/workspace/test')
  })

  it('continues when the directory exists and the user confirms', async () => {
    existsSyncMock.mockReturnValue(true)
    const {selectProjectDir} = await import('../select-project-dir')

    await expect(selectProjectDir({baseDir: '/workspace'})).resolves.toBe('/workspace/app')

    expect(confirmMock).toHaveBeenCalledWith({
      message: '이미 있는 폴더입니다. 기존 폴더 내용을 수정 또는 삭제할 수 있습니다. 정말 여기서 작업할까요?',
      initialValue: true,
    })
  })

  it('returns null when the path exists but is not a directory', async () => {
    existsSyncMock.mockReturnValue(true)
    statSyncMock.mockReturnValue({isDirectory: () => false})
    const {selectProjectDir} = await import('../select-project-dir')

    await expect(selectProjectDir({baseDir: '/workspace'})).resolves.toBeNull()

    expect(confirmMock).not.toHaveBeenCalled()
    expect(logErrorMock).toHaveBeenCalledWith('작업 폴더가 아닌 파일 경로입니다.')
  })

  it('returns null when an existing directory is declined', async () => {
    existsSyncMock.mockReturnValue(true)
    confirmMock.mockResolvedValue(false)
    const {selectProjectDir} = await import('../select-project-dir')

    await expect(selectProjectDir({baseDir: '/workspace'})).resolves.toBeNull()
  })

  it('returns null when the folder prompt is cancelled', async () => {
    textMock.mockResolvedValue('cancel')
    const {selectProjectDir} = await import('../select-project-dir')

    await expect(selectProjectDir({baseDir: '/workspace'})).resolves.toBeNull()
    expect(existsSyncMock).not.toHaveBeenCalled()
  })
})
