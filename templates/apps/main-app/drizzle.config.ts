import {defineConfig} from 'drizzle-kit'

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'file:./data/app.db',
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  },
})
