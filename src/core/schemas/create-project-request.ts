import {z} from 'zod'
import {projectNameSchema} from './project-name'

export const createProjectRequestSchema = z
  .object({
    projectName: projectNameSchema,
    projectDir: z.string().trim().min(1, {error: '프로젝트 폴더를 선택해주세요.'}),
    createGithubRepository: z.boolean(),
    deployVercel: z.boolean(),
    openCodex: z.boolean(),
    startDevServer: z.boolean(),
  })
  .refine((value) => !(value.deployVercel && !value.createGithubRepository), {
    error: 'Vercel 배포에는 GitHub 저장소 생성이 필요합니다.',
  })

export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>
