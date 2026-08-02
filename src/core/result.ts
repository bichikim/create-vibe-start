export type Result<T = void> =
  | {ok: true; value: T}
  | {ok: false; message: string; cancelled?: boolean}

export function ok<T>(value: T): Result<T> {
  return {ok: true, value}
}

export function err(message: string, options?: {cancelled?: boolean}): Result<never> {
  return options?.cancelled
    ? {ok: false, message, cancelled: true}
    : {ok: false, message}
}

/** Returns a safe message for user-facing error rendering. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
}

/** Returns a diagnostic detail that preserves non-Error throw values. */
export function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
