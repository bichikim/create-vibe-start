import {z} from 'zod'

const EnvSchema = z.object({
  TURSO_DATABASE_URL: z.string().min(1).default('file:./data/app.db'),
  TURSO_AUTH_TOKEN: z.string().optional(),
})

export const env = EnvSchema.parse(process.env)
