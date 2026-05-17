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
- App: Nitro, Vite, Vue Router, Pinia, Pinia Colada, Tailwind CSS, Zod, oRPC, Drizzle, libSQL

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

### Database

- Local SQLite-compatible data lives at `apps/main-app/data/app.db` via `DATABASE_URL=file:./data/app.db`.
- Vercel production uses Turso/libSQL with `DATABASE_URL=libsql://...` and `TURSO_AUTH_TOKEN`.
- Use `drizzle-orm` + `drizzle-kit`. Schema in `apps/main-app/server/db/schema.ts`, migrations in `apps/main-app/drizzle/`.
- Run `pnpm --filter @vibe-start/main-app db:generate`, `db:migrate`, or `db:push` for schema changes.

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
- Set `DATABASE_URL` and `TURSO_AUTH_TOKEN` in Vercel environment variables.
