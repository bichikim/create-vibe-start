import {afterEach, describe, expect, it} from 'vitest'

const originalPlatform = process.platform

function setPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', {
    value: platform,
  })
}

afterEach(() => {
  setPlatform(originalPlatform)
})

describe('detectPlatform', () => {
  it('maps darwin to macos', async () => {
    setPlatform('darwin')
    const {detectPlatform} = await import('../detect-platform.js')

    expect(detectPlatform()).toBe('macos')
  })

  it('maps win32 to windows', async () => {
    setPlatform('win32')
    const {detectPlatform} = await import('../detect-platform.js')

    expect(detectPlatform()).toBe('windows')
  })

  it('maps other platforms to linux', async () => {
    setPlatform('freebsd')
    const {detectPlatform} = await import('../detect-platform.js')

    expect(detectPlatform()).toBe('linux')
  })
})
