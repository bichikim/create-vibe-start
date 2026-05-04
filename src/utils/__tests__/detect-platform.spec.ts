import {afterEach, describe, expect, it, vi} from 'vitest'

function setPlatform(platform: NodeJS.Platform) {
  vi.spyOn(process, 'platform', 'get').mockReturnValue(platform)
}

afterEach(() => {
  vi.restoreAllMocks()
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
