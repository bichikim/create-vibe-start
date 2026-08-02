import {type z, ZodError} from 'zod'
import {err, ok, type Result} from '../result'

/** Returns the first Zod issue message for CLI/UI error surfaces. */
export function firstIssueMessage(error: ZodError): string {
  return error.issues[0]?.message ?? error.message
}

/** Parses with a schema and throws a plain Error with the first issue message. */
export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new Error(firstIssueMessage(result.error))
  }
  return result.data
}

export function parseResult<T>(schema: z.ZodType<T>, value: unknown): Result<T> {
  const result = schema.safeParse(value)
  if (!result.success) {
    return err(firstIssueMessage(result.error))
  }
  return ok(result.data)
}
