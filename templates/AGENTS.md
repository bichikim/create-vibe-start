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

- Shared: oxlint, oxfmt, vitest, typescript, monorepo
- Frontend: vite, vue, tailwind, ofetch, @pinia/colada, pinia, oRPC
- Backend: node.js >= 22, hono, zod, sqlite, oRPC, drizzle

### Package Manager

- Use `pnpm` with workspaces. Do not commit alternative lockfiles.
- Node.js >= 22 is required across every package.

### Monorepo Layout

```
.
├── apps/
│   ├── client/                # Vue frontend (vite)
│   │   └── src/
│   │       ├── routes/        # page-level views
│   │       ├── components/    # reusable UI
│   │       ├── stores/        # pinia stores
│   │       └── utils/         # framework-agnostic helpers
│   └── server/                # Hono backend (node.js)
│       └── src/
│           ├── routes/        # hono route handlers
│           ├── modules/       # feature-scoped business logic
│           ├── db/            # sqlite client and schema
│           └── utils/         # framework-agnostic helpers
└── packages/
    └── utils/                 # Shared utilities consumed by apps
```

### Scripts

Every package exposes the same script names. Run at the root with `pnpm -r <script>` or scope with `pnpm --filter <pkg> <script>`.

| Script | Purpose |
|---|---|
| `pnpm dev` | Dev server (vite for client, tsx watch for server) |
| `pnpm build` | Production build |
| `pnpm test` | Vitest |
| `pnpm lint` | oxlint |
| `pnpm format` | oxfmt |
| `pnpm typecheck` | TypeScript, no emit |

### Path Aliases

- Each package maps `@/` to its own `src/` via `tsconfig.json` `paths` and `vite-tsconfig-paths`.
- Cross-package imports use the workspace name (e.g. `import { x } from "@repo/utils"`), never relative `../../`.

### Environment Variables

- Each app has its own `.env` next to its `package.json`. Commit `.env.example`, never `.env`.
- Client variables must be prefixed `VITE_`.
- Validate `process.env` with zod at startup (`src/env.ts`); import the typed object instead of reading `process.env` directly.

### Database

- SQLite file lives at `apps/server/data/app.db` (gitignored). Override with `DATABASE_URL`.
- Use `drizzle-orm` + `drizzle-kit`. Schema in `apps/server/src/db/schema.ts`, migrations in `apps/server/drizzle/`.
- `pnpm --filter server db:generate` and `db:migrate` for schema changes.

### Testing

- Vitest. Test files sit next to the code as `*.test.ts`.
- No real network, filesystem (outside `os.tmpdir()`), or DB calls — mock external boundaries.

### Styling

- Tailwind config lives in `apps/client/` and is consumed only by the client.
- Global CSS at `apps/client/src/styles/index.css` with `@tailwind` directives; no other global stylesheets.
- Prefer utility classes; extract a component only when the same pattern repeats three or more times.

### Lint & Format

- `pnpm lint` (oxlint) and `pnpm format` (oxfmt) must pass before commit.
- Import order: node builtins → external → workspace packages (`@repo/*`) → relative (`@/...`) → side-effect imports last.

### Git Hooks & CI

- `simple-git-hooks` + `lint-staged` run oxlint, oxfmt, and `tsc --noEmit` on staged files pre-commit.
- GitHub Actions runs `pnpm lint && pnpm typecheck && pnpm test && pnpm build` on every PR.

### Deployment

- `apps/client` → Vercel.
- `apps/server` → a host with persistent disk for SQLite (Fly.io by default). Set `DATABASE_URL` and secrets via the host's env settings.