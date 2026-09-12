import {beforeEach, describe, expect, it, vi} from 'vitest'

const logStepMock = vi.fn()
const logMessageMock = vi.fn()
const outroMock = vi.fn()

vi.mock('@clack/prompts', () => ({
  log: {
    step: logStepMock,
    message: logMessageMock,
  },
  outro: outroMock,
}))

describe('showComplete', () => {
  beforeEach(() => {
    logStepMock.mockReset()
    logMessageMock.mockReset()
    outroMock.mockReset()
  })

  it('prints a ready outro when every step is ready', async () => {
    const {showComplete} = await import('../complete')

    showComplete([
      {name: 'GitHub', status: 'ready', message: 'GitHub 로그인 완료'},
      {name: 'Vercel', status: 'ready', message: 'Vercel 로그인 완료'},
    ])

    expect(logStepMock).toHaveBeenCalledWith('준비 결과')
    expect(logMessageMock).toHaveBeenCalledTimes(2)
    expect(outroMock).toHaveBeenCalledWith('계정 준비 완료')
  })

  it('prints a partial outro when a step is skipped or failed', async () => {
    const {showComplete} = await import('../complete')

    showComplete([{name: 'Codex', status: 'skipped', message: 'Codex 로그인을 건너뜀'}])

    expect(logMessageMock).toHaveBeenCalledWith(expect.stringContaining('Codex'))
    expect(outroMock).toHaveBeenCalledWith('완료되지 않은 단계가 있습니다. 필요할 때 다시 실행해주세요.')
  })

  it('prints failed steps with the failure marker', async () => {
    const {showComplete} = await import('../complete')

    showComplete([{name: 'Vercel', status: 'failed', message: 'Vercel 로그인 실패'}])

    expect(logMessageMock).toHaveBeenCalledWith(expect.stringContaining('! Vercel'))
  })
})
