import {isRecord} from '../utils/is-record'

/** 정식 생성물의 호환성을 보장하기 위해 package.json의 명시적 버전만 반환한다. */
export function resolveCliVersion(packageMetadata: unknown): string {
  if (!isRecord(packageMetadata) || typeof packageMetadata.version !== 'string' || !packageMetadata.version.trim()) {
    throw new Error('create-vibe-start package.json에서 CLI 버전을 찾을 수 없습니다.')
  }

  return packageMetadata.version.trim()
}
