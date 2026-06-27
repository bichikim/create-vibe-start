import {beforeEach, describe, expect, it, vi} from 'vitest'

const delayMock = vi.fn()
const logWarnMock = vi.fn()

vi.mock('node:timers/promises', () => ({
  setTimeout: delayMock,
}))

vi.mock('@clack/prompts', () => ({
  log: {
    warn: logWarnMock,
  },
}))

describe('network retry utilities', () => {
  beforeEach(() => {
    delayMock.mockReset().mockResolvedValue(undefined)
    logWarnMock.mockReset()
  })

  it('retries explicit network errors up to success', async () => {
    const {withNetworkRetry} = await import('../network-retry')
    const operation = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('request failed'), {code: 'ENOTFOUND'}))
      .mockResolvedValueOnce('ok')

    await expect(withNetworkRetry('gh repo view', operation)).resolves.toBe('ok')

    expect(operation).toHaveBeenCalledTimes(2)
    expect(delayMock).toHaveBeenCalledWith(500)
    expect(logWarnMock).toHaveBeenCalledWith('네트워크 오류로 재시도합니다 (2/3): gh repo view')
  })

  it('does not retry errors that are not clearly network-related', async () => {
    const {withNetworkRetry} = await import('../network-retry')
    const error = new Error('authentication failed')
    const operation = vi.fn().mockRejectedValue(error)

    await expect(withNetworkRetry('gh repo view', operation)).rejects.toBe(error)

    expect(operation).toHaveBeenCalledOnce()
    expect(delayMock).not.toHaveBeenCalled()
  })

  it('throws the original error after the final retry fails', async () => {
    const {withNetworkRetry} = await import('../network-retry')
    const finalError = Object.assign(new Error('socket hang up'), {code: 'ECONNRESET'})
    const operation = vi.fn<() => Promise<{status: number}>>()
      .mockRejectedValueOnce(Object.assign(new Error('timeout'), {code: 'ETIMEDOUT'}))
      .mockRejectedValueOnce(Object.assign(new Error('fetch failed'), {code: 'UND_ERR_CONNECT_TIMEOUT'}))
      .mockRejectedValueOnce(finalError)

    await expect(withNetworkRetry('vercel env pull', operation)).rejects.toBe(finalError)

    expect(operation).toHaveBeenCalledTimes(3)
    expect(delayMock).toHaveBeenNthCalledWith(1, 500)
    expect(delayMock).toHaveBeenNthCalledWith(2, 1000)
  })

  it('retries results that match an explicit retry predicate', async () => {
    const {isRetryableHttpStatus, withNetworkRetry} = await import('../network-retry')
    const operation = vi.fn()
      .mockResolvedValueOnce({status: 500})
      .mockResolvedValueOnce({status: 200})

    await expect(
      withNetworkRetry('Vercel deployment 상태 확인', operation, {
        shouldRetryResult: (result: {status: number}) => isRetryableHttpStatus(result.status),
      }),
    ).resolves.toEqual({status: 200})

    expect(operation).toHaveBeenCalledTimes(2)
    expect(logWarnMock).toHaveBeenCalledWith('네트워크 오류로 재시도합니다 (2/3): Vercel deployment 상태 확인')
  })

  it('detects retryable network errors from non-Error values and extended error fields', async () => {
    const {isRetryableNetworkError} = await import('../network-retry')

    expect(isRetryableNetworkError('socket hang up')).toBe(true)
    expect(isRetryableNetworkError(Object.assign(new Error('plain failure'), {
      code: 123,
      stderr: 'network unavailable',
    }))).toBe(true)
    expect(isRetryableNetworkError(Object.assign(new Error('plain failure'), {
      code: 123,
      stderr: 456,
    }))).toBe(false)
  })

  it('classifies only retryable HTTP statuses', async () => {
    const {isRetryableHttpStatus} = await import('../network-retry')

    expect(isRetryableHttpStatus(408)).toBe(true)
    expect(isRetryableHttpStatus(429)).toBe(true)
    expect(isRetryableHttpStatus(500)).toBe(true)
    expect(isRetryableHttpStatus(400)).toBe(false)
  })
})
