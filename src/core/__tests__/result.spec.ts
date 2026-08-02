import {describe, expect, it} from 'vitest'
import {err, errorDetail, errorMessage, ok} from '../result'

describe('result helpers', () => {
  it('builds ok results', () => {
    expect(ok(42)).toEqual({ok: true, value: 42})
  })

  it('builds err results with optional cancelled', () => {
    expect(err('boom')).toEqual({ok: false, message: 'boom'})
    expect(err('stop', {cancelled: true})).toEqual({
      ok: false,
      message: 'stop',
      cancelled: true,
    })
  })

  it('uses a safe user-facing message for non-Error throws', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
    expect(errorMessage('boom')).toBe('알 수 없는 오류가 발생했습니다.')
  })

  it('keeps stringified non-Error throws in progress details', () => {
    expect(errorDetail(new Error('boom'))).toBe('boom')
    expect(errorDetail({reason: 'boom'})).toBe('[object Object]')
  })
})
