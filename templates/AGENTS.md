# Agent Instructions

## Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

## Import Paths

- Do not include `.js` or `.ts` extensions in TypeScript import paths.
- TypeScript module resolution handles source imports without those extensions.
- Keep required extensions for non-code assets, such as `.svg` and `.png`.

## Environment

If you are starting from scratch, set up this environment. If the project already exists, it must match the environment below.

- Shared: oxlint, oxfmt, vitest, typescript, pnpm workspace
- App: Nitro, Vite, Vue Router, Pinia, Pinia Colada, Tailwind CSS, Zod, oRPC, Drizzle, libSQL, Better Auth

### Package Manager

- Use `pnpm` with workspaces. Do not commit alternative lockfiles.
- Node.js >= 22 is required across every package.

### Monorepo Layout

```
.
├── apps/
│   └── main-app/              # Nitro + Vue full-stack app
│       ├── src/               # Vue client
│       │   └── views/         # Route-level Vue views
│       ├── server/            # Nitro routes, oRPC router, DB code
│       └── drizzle/           # Drizzle migrations
└── pnpm-workspace.yaml
```

### Scripts

Run standard scripts from the root, or scope app commands with `pnpm --filter @vibe-start/main-app <script>`.

| Script | Purpose |
|---|---|
| `pnpm dev` | Nitro/Vite dev server |
| `pnpm build` | Production build |
| `pnpm test` | Vitest |
| `pnpm lint` | oxlint |
| `pnpm format` | oxfmt |
| `pnpm typecheck` | TypeScript, no emit |

### Path Aliases

- The app maps `@/` to `src/` and `@server/` to `server/`.
- Do not include `.js` or `.ts` extensions in TypeScript import paths.

### Environment Variables

- The app has its own `.env` next to `apps/main-app/package.json`. Commit `.env.example`, never `.env`.
- Client variables must be prefixed `VITE_`.
- Validate server env with zod in `server/env.ts`; import the typed object instead of reading `process.env` directly.

### Authentication

- Better Auth lives in `apps/main-app/server/auth.ts` with email/password enabled.
- `BETTER_AUTH_URL` is the canonical base URL for auth callbacks. Omit it on Vercel to use `VERCEL_PROJECT_PRODUCTION_URL` (production) or `VERCEL_URL` (preview) at runtime. In development, any `localhost` / `127.0.0.1` origin is trusted regardless of port.
- Add LAN or custom hosts via `BETTER_AUTH_TRUSTED_ORIGINS` (comma-separated).
- Nitro mounts the handler at `server/routes/api/auth/[...all].ts` using `auth.handler(event.req)`.
- Vue client: `src/lib/auth-client.ts` (`better-auth/vue`). Session cookies must be sent to oRPC (`credentials: "include"` in `src/orpc.ts`). Leave `VITE_BETTER_AUTH_URL` empty to use `window.location.origin`.
- Regenerate auth tables with `pnpm --filter @vibe-start/main-app auth:generate` after changing the auth config.

### Database

- Local SQLite-compatible data lives at `apps/main-app/data/app.db` via `TURSO_DATABASE_URL=file:./data/app.db`.
- Vercel production uses Turso/libSQL with `TURSO_DATABASE_URL=libsql://...` and `TURSO_AUTH_TOKEN`.
- Use `drizzle-orm` + `drizzle-kit`. App tables in `server/db/schema.ts` (re-exports `auth-schema.ts` + `notes`). Migrations in `apps/main-app/drizzle/`.
- After scaffold, run `db:migrate` so Better Auth tables exist. `notes` still uses `ensureDatabase()` for the demo table.
- Run `pnpm --filter @vibe-start/main-app db:generate` and `db:migrate` for schema changes.

### Testing

- Vitest. Test files sit next to the code as `*.test.ts`.
- No real network, filesystem outside `os.tmpdir()`, or DB calls in unit tests. Mock external boundaries.

### Styling

- Global CSS lives at `apps/main-app/src/style.css`.
- Use Tailwind CSS utility classes for component styling.
- Keep `src/style.css` limited to `@import "tailwindcss";` and theme-level tokens unless a global style is necessary.

### Client State

- Use Vue Router for route-level screens under `src/views/`.
- Use Pinia Colada for server data fetching, cache state, mutations, and invalidation.
- Use plain Pinia stores only for local cross-route state that is not server data.

### Lint & Format

- `pnpm lint` (oxlint) and `pnpm format` (oxfmt) must pass before commit.
- Import order: node builtins → external → workspace packages → relative aliases → side-effect imports last.

### Deployment

- `apps/main-app` → Vercel.
- Set Vercel project root to `apps/main-app` or use equivalent build settings.
- The Vercel deployment flow provisions Turso through the Marketplace with the `starter` plan in `iad1` so it automatically injects `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. `create-vibe-start` sets production `BETTER_AUTH_SECRET` before the first deploy; `BETTER_AUTH_URL` comes from Vercel system env at runtime.
