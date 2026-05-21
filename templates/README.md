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

Local development uses `TURSO_DATABASE_URL=file:./data/app.db`. Set `BETTER_AUTH_SECRET` to a random 32+ character value before production. Vercel deployment provisions Turso through the Marketplace with the `starter` plan in `iad1` and automatically injects `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. Add `BETTER_AUTH_SECRET` manually in Vercel project settings.
