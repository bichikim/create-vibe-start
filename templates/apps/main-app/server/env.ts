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

/** 명시값 → Vercel 시스템 변수 → 로컬 기본값 순으로 Better Auth base URL을 정합니다. */
function resolveBetterAuthUrl(explicit: string | undefined) {
  if (explicit) {
    return explicit
  }

  const host =
    process.env.VERCEL_ENV === 'production'
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL
      : process.env.VERCEL_URL

  if (host) {
    return `https://${host}`
  }

  return 'http://localhost:3000'
}

const envInputSchema = z.object({
  TURSO_DATABASE_URL: z.string().min(1).default('file:./data/app.db'),
  TURSO_AUTH_TOKEN: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().min(1).default('dev-only-change-me'),
  BETTER_AUTH_URL: z.string().url().optional(),
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional().transform(parseTrustedOrigins),
})

type EnvInput = z.infer<typeof envInputSchema>

const envSchema = envInputSchema.transform((data: EnvInput) => ({
  ...data,
  BETTER_AUTH_URL: resolveBetterAuthUrl(data.BETTER_AUTH_URL),
}))

export const env = envSchema.parse(process.env)
