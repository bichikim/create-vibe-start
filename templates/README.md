# {{projectName}}

Single full-stack starter with Nitro, Vue, oRPC, Zod, Drizzle, and SQLite-compatible storage.

## Setup

```sh
pnpm install
cp .env.example apps/main-app/.env
pnpm --filter @{{projectName}}/main-app db:push
pnpm dev
```

Local development uses `DATABASE_URL=file:./data/app.db`. On Vercel, use Turso/libSQL with `DATABASE_URL=libsql://...` and `TURSO_AUTH_TOKEN`.
