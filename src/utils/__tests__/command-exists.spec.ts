import {beforeEach, describe, expect, it, vi} from 'vitest'

const whichMock = vi.fn()

vi.mock('which', () => ({
  default: whichMock,
}))

describe('commandExists', () => {
  beforeEach(() => {
    whichMock.mockReset()
  })

  it('returns true when which resolves', async () => {
    whichMock.mockResolvedValue('/usr/local/bin/gh')
    const {commandExists} = await import('../command-exists')

    await expect(commandExists('gh')).resolves.toBe(true)
    expect(whichMock).toHaveBeenCalledWith('gh')
  })

  it('returns false when which rejects', async () => {
    whichMock.mockRejectedValue(new Error('not found'))
    const {commandExists} = await import('../command-exists')

    await expect(commandExists('missing')).resolves.toBe(false)
  })
})
