import {z} from 'zod'
import {projectNameSchema} from './project-name'

export const repairVercelOptionsSchema = z.object({
  dir: z.string().trim().min(1, {error: '프로젝트 폴더를 선택해주세요.'}),
  projectName: projectNameSchema,
  githubRepository: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z
      .string()
      .trim()
      .regex(/^[^/\s]+\/[^/\s]+$/u, {error: 'GitHub 저장소는 owner/name 형식이어야 합니다.'})
      .optional(),
  ),
})

export type RepairVercelOptions = z.infer<typeof repairVercelOptionsSchema>
