import {describe, expect, it} from 'vitest'
import {createPromptAnswerQueue} from '../helpers/prompt-answers'

describe('createPromptAnswerQueue', () => {
  it('returns confirm, text, and multiselect answers in order', async () => {
    const prompts = createPromptAnswerQueue([true, 'demo-app', ['codex']])

    await expect(prompts.confirm()).resolves.toBe(true)
    await expect(prompts.text()).resolves.toBe('demo-app')
    await expect(prompts.multiselect()).resolves.toEqual(['codex'])
    expect(prompts.remaining()).toBe(0)
  })

  it('fails when the queue is empty or the type mismatches', async () => {
    const empty = createPromptAnswerQueue([])
    await expect(empty.confirm()).rejects.toThrow('no remaining answer for confirm')

    const wrongType = createPromptAnswerQueue(['not-bool'])
    await expect(wrongType.confirm()).rejects.toThrow('expected boolean for confirm')
  })
})
