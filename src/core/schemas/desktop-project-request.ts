import {z} from 'zod'
import {createProjectRequestSchema} from './create-project-request'

const workflowStepIdSchema = z.enum([
  'prepare-tools',
  'generate-template',
  'install-dependencies',
  'create-github-repository',
  'deploy-vercel',
  'launch-codex',
  'start-dev-server',
])

export const desktopProjectRequestSchema = createProjectRequestSchema.and(
  z.object({
    gitAuthorName: z.string().trim().min(1, {error: '이름을 입력해주세요.'}),
    gitAuthorEmail: z
      .string()
      .trim()
      .refine((value) => value.includes('@'), {error: '이메일을 입력해주세요.'}),
    templateDir: z.string().trim().min(1, {error: '템플릿 경로가 필요합니다.'}),
    resumeFromStep: workflowStepIdSchema.optional(),
  }),
)

export type DesktopProjectRequest = z.infer<typeof desktopProjectRequestSchema>
