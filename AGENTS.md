# Agent Instructions

## Project Purpose

This is a CLI that creates new vibe-coding projects by copying curated template content into a target project directory.

The `templates/` directory is the source bundle for generated projects. Files listed in `templates/template-manifest.json` are copied into the target project; entries with `template: true` are rendered through node-plop/Handlebars before being written.

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

## Branch Sync

- Before starting work, pull the current working branch from its remote to make sure it is up to date.

## Dependency Installation

When dependency installation is required in this project:

- Do not run `pnpm i` inside the sandbox first.
- Always request escalated execution for `pnpm i`.
- Use the global pnpm store.
- Do not create or use a local `.pnpm-store`.
- Do not add `store-dir=.pnpm-store` to `.npmrc`.

If `pnpm i` is needed, run it only with escalated permissions because this project expects access to the global pnpm store.

## Cursor Cloud specific instructions

This is a single-package CLI tool (not a monorepo). No databases, Docker, or external services are required.

### Available commands

All standard commands are in `package.json` scripts. Key ones:

| Command | Purpose |
|---|---|
| `pnpm lint` | Lint via oxlint |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm test` | Run Vitest suite (47 tests, all external calls mocked) |
| `pnpm build` | Production build via Vite → `dist/cli.js` |
| `pnpm dev` | Run CLI in dev mode via tsx (writes to `.test-project/`) |
| `node dist/cli.js` | Run the built CLI directly |

### Gotchas

- pnpm may warn about ignored build scripts for `esbuild`. The platform binary is already present and everything works despite the warning — no need to run `pnpm approve-builds`.
- The `pnpm dev` script hardcodes `--project-dir ./.test-project`. Do not pass additional `--project-dir` via `--` or it will error with "too many arguments".
- The CLI is interactive (uses `@clack/prompts`). For non-interactive testing, use `--skip-github --skip-vercel --skip-codex` to bypass external tool setup steps. The `reset --dry-run --yes` subcommand is fully non-interactive.
- Node.js >= 22 is required (`engines.node` in `package.json`).
