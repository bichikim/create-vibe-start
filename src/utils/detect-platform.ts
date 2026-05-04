export type SupportedPlatform = 'macos' | 'linux' | 'windows'

export function detectPlatform(): SupportedPlatform {
  if (process.platform === 'darwin') {
    return 'macos'
  }

  if (process.platform === 'win32') {
    return 'windows'
  }

  return 'linux'
}
