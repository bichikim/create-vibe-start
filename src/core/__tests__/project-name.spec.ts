import {describe, expect, it} from 'vitest'
import {assertValidProjectName, projectNameValidationError} from '../project-name'

describe('projectNameValidationError', () => {
  it.each([
    'a',
    '1-project',
    'my.project_name--2',
    `a${'b'.repeat(99)}`,
    ' valid-name ',
  ])('accepts %s', (projectName) => {
    expect(projectNameValidationError(projectName)).toBeUndefined()
  })

  it.each([
    ['', '프로젝트 이름을 입력해주세요.'],
    ['a'.repeat(101), '프로젝트 이름은 100자 이하여야 합니다.'],
    ['My-vibe-app2', '대문자는 사용할 수 없습니다. `my-vibe-app2`처럼 입력해주세요.'],
    ['.my-app', '프로젝트 이름의 첫 글자는 소문자나 숫자여야 합니다.'],
    ['my---app', '프로젝트 이름에는 ---를 사용할 수 없습니다.'],
    ['my app', '프로젝트 이름에는 소문자, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다.'],
    ['my/app', '프로젝트 이름에는 소문자, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다.'],
    ['한글', '프로젝트 이름의 첫 글자는 소문자나 숫자여야 합니다.'],
  ])('rejects %s', (projectName, message) => {
    expect(projectNameValidationError(projectName)).toBe(message)
  })
})

describe('assertValidProjectName', () => {
  it('returns for a valid project name', () => {
    expect(assertValidProjectName('my-app')).toBeUndefined()
  })

  it('throws the shared validation message', () => {
    expect(() => assertValidProjectName('My-app')).toThrow(
      '대문자는 사용할 수 없습니다. `my-app`처럼 입력해주세요.',
    )
  })
})
