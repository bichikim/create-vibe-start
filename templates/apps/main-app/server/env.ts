import {z} from 'zod'

function parseTrustedOrigins(value: string | undefined) {
  if (!value) {
    return []
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

const EnvSchema = z.object({
  TURSO_DATABASE_URL: z.string().min(1).default('file:./data/app.db'),
  TURSO_AUTH_TOKEN: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().min(1).default('dev-only-change-me'),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional().transform(parseTrustedOrigins),
})

export const env = EnvSchema.parse(process.env)
