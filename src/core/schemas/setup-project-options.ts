import {z} from 'zod'

// Commander 입력을 한 번 검증한 뒤 setup 내부에는 정규화된 경로와 boolean만 전달한다.
export const setupProjectOptionsSchema = z.object({
  dir: z.string().trim().min(1, {error: '프로젝트 폴더를 선택해주세요.'}),
  check: z.boolean().default(false),
})

export type SetupProjectOptions = z.infer<typeof setupProjectOptionsSchema>
