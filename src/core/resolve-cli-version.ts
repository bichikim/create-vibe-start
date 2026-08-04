import {isRecord} from '../utils/is-record'

export function resolveCliVersion(packageMetadata: unknown): string {
  if (!isRecord(packageMetadata) || typeof packageMetadata.version !== 'string' || !packageMetadata.version.trim()) {
    throw new Error('create-vibe-start package.json에서 CLI 버전을 찾을 수 없습니다.')
  }

  return packageMetadata.version.trim()
}
