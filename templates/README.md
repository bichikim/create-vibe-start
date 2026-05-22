# {{projectName}}

Single full-stack starter with Nitro, Vue, oRPC, Zod, Drizzle, Better Auth, and SQLite-compatible storage.

## Setup

```sh
pnpm install
cp apps/main-app/.env.example apps/main-app/.env
pnpm --filter @{{projectName}}/main-app db:migrate
pnpm dev
```

Open `http://localhost:3000/login` to create an account. Notes can be listed without signing in; creating notes requires a session.

Local development uses `TURSO_DATABASE_URL=file:./data/app.db`. Set `BETTER_AUTH_SECRET` to a random 32+ character value before production. Vercel deployment provisions Turso through the Marketplace with the `starter` plan in `iad1` and automatically injects `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. On Vercel, `BETTER_AUTH_URL` is resolved at runtime from `VERCEL_URL` / `VERCEL_PROJECT_PRODUCTION_URL` unless you set it explicitly. `create-vibe-start` sets production `BETTER_AUTH_SECRET` automatically.
