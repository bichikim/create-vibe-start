/**
 * Values returned by mocked `@clack/prompts` helpers, in call order.
 * Use `string[]` for `multiselect`, `boolean` for `confirm`, `string` for `text`/`select`.
 */
export type PromptAnswer = boolean | string | string[]

export type PromptAnswerQueue = {
  confirm: () => Promise<boolean>
  text: () => Promise<string>
  select: () => Promise<string>
  multiselect: () => Promise<string[]>
  remaining: () => number
}

/**
 * Build a thin FIFO answer queue for Vitest `@clack/prompts` mocks.
 * Intended for in-process CLI e2e, not real TTY keypress simulation.
 */
export function createPromptAnswerQueue(answers: PromptAnswer[]): PromptAnswerQueue {
  const queue = [...answers]

  function next(kind: string): PromptAnswer {
    if (queue.length === 0) {
      throw new Error(`prompt-answers: no remaining answer for ${kind}`)
    }
    return queue.shift() as PromptAnswer
  }

  return {
    confirm: async () => {
      const value = next('confirm')
      if (typeof value !== 'boolean') {
        throw new Error(`prompt-answers: expected boolean for confirm, got ${typeof value}`)
      }
      return value
    },
    text: async () => {
      const value = next('text')
      if (typeof value !== 'string') {
        throw new Error(`prompt-answers: expected string for text, got ${typeof value}`)
      }
      return value
    },
    select: async () => {
      const value = next('select')
      if (typeof value !== 'string') {
        throw new Error(`prompt-answers: expected string for select, got ${typeof value}`)
      }
      return value
    },
    multiselect: async () => {
      const value = next('multiselect')
      if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
        throw new Error('prompt-answers: expected string[] for multiselect')
      }
      return value
    },
    remaining: () => queue.length,
  }
}
