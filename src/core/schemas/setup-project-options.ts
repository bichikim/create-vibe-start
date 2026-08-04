import {z} from 'zod'

export const setupProjectOptionsSchema = z.object({
  dir: z.string().trim().min(1, {error: '프로젝트 폴더를 선택해주세요.'}),
  check: z.boolean().default(false),
})

export type SetupProjectOptions = z.infer<typeof setupProjectOptionsSchema>
