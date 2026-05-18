/** create-vibe-start가 설치 명령을 제공하는 운영체제 이름입니다. */
export type SupportedPlatform = 'macos' | 'linux' | 'windows'

/**
 * 현재 Node.js 실행 플랫폼을 지원하는 운영체제 이름으로 변환합니다.
 *
 * @returns macOS, Windows, Linux 중 하나입니다.
 */
export function detectPlatform(): SupportedPlatform {
  if (process.platform === 'darwin') {
    return 'macos'
  }

  if (process.platform === 'win32') {
    return 'windows'
  }

  return 'linux'
}
