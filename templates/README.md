# {{projectName}}

Single full-stack starter with Nitro, Vue, oRPC, Zod, Drizzle, and SQLite-compatible storage.

## Setup

```sh
pnpm install
cp .env.example apps/main-app/.env
pnpm --filter @{{projectName}}/main-app db:push
pnpm dev
```

Local development uses `TURSO_DATABASE_URL=file:./data/app.db`. Vercel deployment provisions Turso through the Marketplace with the `starter` plan in `iad1` and automatically injects `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
