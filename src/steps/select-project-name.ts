import {isCancel, text} from '@clack/prompts'

const projectNamePattern = /^[a-z0-9][a-z0-9-]*$/u

/**
 * 새 프로젝트와 GitHub 저장소에 사용할 이름을 입력받습니다.
 *
 * @returns 선택된 프로젝트 이름이며, 취소되면 `null`입니다.
 */
export async function selectProjectName(): Promise<string | null> {
  const answer = await text({
    message: '프로젝트 이름을 입력해주세요.',
    placeholder: 'my-vibe-app',
    validate(value) {
      const name = value.trim()

      if (!name) {
        return '프로젝트 이름을 입력해주세요.'
      }

      if (!projectNamePattern.test(name)) {
        return '소문자, 숫자, 하이픈만 사용할 수 있고 첫 글자는 소문자나 숫자여야 합니다.'
      }
    },
  })

  return isCancel(answer) ? null : answer.trim()
}
