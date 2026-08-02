import {describe, expect, it} from 'vitest'
import {z} from 'zod'
import {firstIssueMessage, parseOrThrow, parseResult} from '../parse'

describe('parseOrThrow', () => {
  it('returns parsed data', () => {
    expect(parseOrThrow(z.string().min(1), 'ok')).toBe('ok')
  })

  it('throws Error with the first issue message, not ZodError', () => {
    expect(() => parseOrThrow(z.string().min(1, {error: 'too short'}), '')).toThrow('too short')
    try {
      parseOrThrow(z.string().min(1, {error: 'too short'}), '')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect(error).not.toBeInstanceOf(z.ZodError)
    }
  })
})

describe('firstIssueMessage', () => {
  it('reads the first issue message', () => {
    const result = z.string().min(1, {error: 'required'}).safeParse('')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(firstIssueMessage(result.error)).toBe('required')
    }
  })

  it('falls back to the error message when issues are empty', () => {
    const error = new z.ZodError([])
    Object.defineProperty(error, 'message', {value: 'fallback'})
    expect(firstIssueMessage(error)).toBe('fallback')
  })
})

describe('parseResult', () => {
  it('returns ok with parsed data', () => {
    expect(parseResult(z.string().min(1), 'ok')).toEqual({ok: true, value: 'ok'})
  })

  it('returns err with the first issue message', () => {
    expect(parseResult(z.string().min(1, {error: 'too short'}), '')).toEqual({
      ok: false,
      message: 'too short',
    })
  })
})
