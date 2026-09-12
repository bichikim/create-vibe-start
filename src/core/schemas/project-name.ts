import {z} from 'zod'
import {firstIssueMessage} from './parse'

const maximumProjectNameLength = 100

export const projectNameSchema = z.string().trim().superRefine((projectName, ctx) => {
  if (!projectName) {
    ctx.addIssue({code: 'custom', message: '프로젝트 이름을 입력해주세요.', fatal: true})
    return z.NEVER
  }
  if (projectName.length > maximumProjectNameLength) {
    ctx.addIssue({code: 'custom', message: '프로젝트 이름은 100자 이하여야 합니다.', fatal: true})
    return z.NEVER
  }
  if (/[A-Z]/u.test(projectName)) {
    ctx.addIssue({
      code: 'custom',
      message: `대문자는 사용할 수 없습니다. \`${projectName.toLowerCase()}\`처럼 입력해주세요.`,
      fatal: true,
    })
    return z.NEVER
  }
  if (!/^[a-z0-9]/u.test(projectName)) {
    ctx.addIssue({
      code: 'custom',
      message: '프로젝트 이름의 첫 글자는 소문자나 숫자여야 합니다.',
      fatal: true,
    })
    return z.NEVER
  }
  if (projectName.includes('---')) {
    ctx.addIssue({code: 'custom', message: '프로젝트 이름에는 ---를 사용할 수 없습니다.', fatal: true})
    return z.NEVER
  }
  if (!/^[a-z0-9._-]+$/u.test(projectName)) {
    ctx.addIssue({
      code: 'custom',
      message: '프로젝트 이름에는 소문자, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다.',
      fatal: true,
    })
    return z.NEVER
  }
})

/** Returns the shared project-name validation message used by every entry point. */
export function projectNameValidationError(value: string): string | undefined {
  const result = projectNameSchema.safeParse(value)
  if (result.success) {
    return undefined
  }
  return firstIssueMessage(result.error)
}

/** Rejects invalid project names before files or external services are changed. */
export function assertValidProjectName(value: string) {
  const error = projectNameValidationError(value)
  if (error) {
    throw new Error(error)
  }
}
