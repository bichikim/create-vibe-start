import {describe, expect, it} from 'vitest'
import {parseOrThrow} from '../parse'
import {repairVercelOptionsSchema} from '../repair-vercel-options'

describe('repairVercelOptionsSchema', () => {
  it('accepts valid options', () => {
    expect(
      parseOrThrow(repairVercelOptionsSchema, {
        dir: '/repo',
        projectName: 'my-app',
        githubRepository: 'owner/name',
      }),
    ).toEqual({
      dir: '/repo',
      projectName: 'my-app',
      githubRepository: 'owner/name',
    })
  })

  it('rejects invalid project names', () => {
    expect(() =>
      parseOrThrow(repairVercelOptionsSchema, {dir: '/repo', projectName: 'My-app'}),
    ).toThrow('대문자는 사용할 수 없습니다. `my-app`처럼 입력해주세요.')
  })

  it('rejects malformed github repositories', () => {
    expect(() =>
      parseOrThrow(repairVercelOptionsSchema, {
        dir: '/repo',
        projectName: 'my-app',
        githubRepository: 'not-a-repo',
      }),
    ).toThrow('GitHub 저장소는 owner/name 형식이어야 합니다.')
  })

  it('treats an empty github repository as omitted', () => {
    expect(
      parseOrThrow(repairVercelOptionsSchema, {
        dir: '/repo',
        projectName: 'my-app',
        githubRepository: '',
      }),
    ).toEqual({
      dir: '/repo',
      projectName: 'my-app',
    })
  })
})
