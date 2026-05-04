# Agent Instructions

## Dependency Installation

When dependency installation is required in this project:

- Do not run `pnpm i` inside the sandbox first.
- Always request escalated execution for `pnpm i`.
- Use the global pnpm store.
- Do not create or use a local `.pnpm-store`.
- Do not add `store-dir=.pnpm-store` to `.npmrc`.

If `pnpm i` is needed, run it only with escalated permissions because this project expects access to the global pnpm store.
