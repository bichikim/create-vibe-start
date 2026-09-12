import path from 'node:path'
import {afterEach, describe, expect, it, vi} from 'vitest'

const originalAppData = process.env.APPDATA
const originalLocalAppData = process.env.LOCALAPPDATA
const originalXdgDataHome = process.env.XDG_DATA_HOME
const originalXdgCacheHome = process.env.XDG_CACHE_HOME

function setPlatform(platform: NodeJS.Platform) {
  vi.spyOn(process, 'platform', 'get').mockReturnValue(platform)
}

function restoreEnvVar(
  name: 'APPDATA' | 'LOCALAPPDATA' | 'XDG_DATA_HOME' | 'XDG_CACHE_HOME',
  value: string | undefined,
) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}

afterEach(() => {
  vi.restoreAllMocks()
  restoreEnvVar('APPDATA', originalAppData)
  restoreEnvVar('LOCALAPPDATA', originalLocalAppData)
  restoreEnvVar('XDG_DATA_HOME', originalXdgDataHome)
  restoreEnvVar('XDG_CACHE_HOME', originalXdgCacheHome)
})

describe('userDataDirectory', () => {
  it('returns Application Support on darwin', async () => {
    setPlatform('darwin')
    const {userDataDirectory} = await import('../user-directories')

    expect(userDataDirectory()).toContain(path.join('Library', 'Application Support'))
  })

  it('returns APPDATA on win32 when set', async () => {
    setPlatform('win32')
    process.env.APPDATA = 'C:\\Users\\me\\AppData\\Roaming'
    const {userDataDirectory} = await import('../user-directories')

    expect(userDataDirectory()).toBe('C:\\Users\\me\\AppData\\Roaming')
  })

  it('uses XDG_DATA_HOME on other platforms when set', async () => {
    setPlatform('linux')
    process.env.XDG_DATA_HOME = '/xdg-data'
    const {userDataDirectory} = await import('../user-directories')

    expect(userDataDirectory()).toBe('/xdg-data')
  })

  it('falls back to ~/.local/share when XDG_DATA_HOME is unset', async () => {
    setPlatform('linux')
    delete process.env.XDG_DATA_HOME
    const {userDataDirectory} = await import('../user-directories')

    expect(userDataDirectory()).toContain(path.join('.local', 'share'))
  })
})

describe('userCacheDirectory', () => {
  it('returns Caches on darwin', async () => {
    setPlatform('darwin')
    const {userCacheDirectory} = await import('../user-directories')

    expect(userCacheDirectory()).toContain(path.join('Library', 'Caches'))
  })

  it('returns LOCALAPPDATA on win32 when set', async () => {
    setPlatform('win32')
    process.env.LOCALAPPDATA = 'C:\\Users\\me\\AppData\\Local'
    const {userCacheDirectory} = await import('../user-directories')

    expect(userCacheDirectory()).toBe('C:\\Users\\me\\AppData\\Local')
  })

  it('uses XDG_CACHE_HOME on other platforms when set', async () => {
    setPlatform('linux')
    process.env.XDG_CACHE_HOME = '/xdg-cache'
    const {userCacheDirectory} = await import('../user-directories')

    expect(userCacheDirectory()).toBe('/xdg-cache')
  })

  it('falls back to ~/.cache when XDG_CACHE_HOME is unset', async () => {
    setPlatform('linux')
    delete process.env.XDG_CACHE_HOME
    const {userCacheDirectory} = await import('../user-directories')

    expect(userCacheDirectory()).toContain('.cache')
  })
})
