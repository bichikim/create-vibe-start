import {isCancel, text} from '@clack/prompts'
import {projectNameValidationError} from '../core/project-name'

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
      return projectNameValidationError(value)
    },
  })

  return isCancel(answer) ? null : answer.trim()
}
