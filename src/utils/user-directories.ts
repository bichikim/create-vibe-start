import {homedir} from 'node:os'
import path from 'node:path'

/**
 * 현재 플랫폼의 사용자 data 디렉터리 경로를 반환합니다.
 *
 * @returns macOS Application Support, Windows APPDATA, 또는 XDG data 디렉터리입니다.
 */
export function userDataDirectory(): string {
  if (process.platform === 'darwin') {
    return path.join(homedir(), 'Library', 'Application Support')
  }

  if (process.platform === 'win32' && process.env.APPDATA) {
    return process.env.APPDATA
  }

  return process.env.XDG_DATA_HOME ?? path.join(homedir(), '.local', 'share')
}

/**
 * 현재 플랫폼의 사용자 cache 디렉터리 경로를 반환합니다.
 *
 * @returns macOS Caches, Windows LOCALAPPDATA, 또는 XDG cache 디렉터리입니다.
 */
export function userCacheDirectory(): string {
  if (process.platform === 'darwin') {
    return path.join(homedir(), 'Library', 'Caches')
  }

  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return process.env.LOCALAPPDATA
  }

  return process.env.XDG_CACHE_HOME ?? path.join(homedir(), '.cache')
}
