import {describe, expect, it} from 'vitest'
import {resolveCliVersion} from '../resolve-cli-version'

describe('resolveCliVersion', () => {
  it('returns a trimmed package version', () => {
    expect(resolveCliVersion({version: ' 1.2.3 '})).toBe('1.2.3')
  })

  it.each([undefined, {}, {version: 1}, {version: ' '}])(
    'rejects package metadata without an explicit version: %j',
    (metadata) => {
      expect(() => resolveCliVersion(metadata)).toThrow(
        'create-vibe-start package.json에서 CLI 버전을 찾을 수 없습니다.',
      )
    },
  )
})
