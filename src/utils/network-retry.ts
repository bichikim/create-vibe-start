import {setTimeout} from 'node:timers/promises'
import {log} from '@clack/prompts'

const MAX_ATTEMPTS = 3
const FIRST_RETRY_DELAY_MS = 500
const SECOND_RETRY_DELAY_MS = 1000
const RETRY_DELAYS_MS = [FIRST_RETRY_DELAY_MS, SECOND_RETRY_DELAY_MS]
const REQUEST_TIMEOUT_STATUS = 408
const TOO_MANY_REQUESTS_STATUS = 429
const SERVER_ERROR_STATUS = 500
const NETWORK_ERROR_PATTERNS = [
  'ETIMEDOUT',
  'ECONNRESET',
  'EAI_AGAIN',
  'ENOTFOUND',
  'ECONNREFUSED',
  'UND_ERR_CONNECT_TIMEOUT',
  'fetch failed',
  'network',
  'timeout',
  'socket hang up',
]

type RetryOptions<T> = {
  shouldRetryResult?: (result: T) => boolean
}

export async function withNetworkRetry<T>(
  label: string,
  operation: () => Promise<T>,
  options: RetryOptions<T> = {},
): Promise<T> {
  async function attemptOperation(attempt: number): Promise<T> {
    try {
      const result = await operation()
      if (attempt < MAX_ATTEMPTS && options.shouldRetryResult?.(result)) {
        await waitForRetry(label, attempt)
        return attemptOperation(attempt + 1)
      }

      return result
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS || !isRetryableNetworkError(error)) {
        throw error
      }

      await waitForRetry(label, attempt)
      return attemptOperation(attempt + 1)
    }
  }

  return attemptOperation(1)
}

export function isRetryableNetworkError(error: unknown) {
  const values = errorValues(error)
  return NETWORK_ERROR_PATTERNS.some((pattern) => (
    values.some((value) => value.toLowerCase().includes(pattern.toLowerCase()))
  ))
}

export function isRetryableHttpStatus(status: number) {
  return status === REQUEST_TIMEOUT_STATUS || status === TOO_MANY_REQUESTS_STATUS || status >= SERVER_ERROR_STATUS
}

async function waitForRetry(label: string, attempt: number) {
  const nextAttempt = attempt + 1
  log.warn(`네트워크 오류로 재시도합니다 (${nextAttempt}/${MAX_ATTEMPTS}): ${label}`)
  await setTimeout(RETRY_DELAYS_MS[attempt - 1])
}

function errorValues(error: unknown) {
  if (error instanceof Error) {
    const values = [error.message]
    const fields = error as Error & {
      code?: unknown
      shortMessage?: unknown
      stderr?: unknown
      stdout?: unknown
    }

    for (const value of [fields.code, fields.shortMessage, fields.stderr, fields.stdout]) {
      if (typeof value === 'string') {
        values.push(value)
      }
    }

    return values
  }

  return [String(error)]
}
