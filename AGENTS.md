# Agent Instructions

## Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

## Dependency Installation

When dependency installation is required in this project:

- Do not run `pnpm i` inside the sandbox first.
- Always request escalated execution for `pnpm i`.
- Use the global pnpm store.
- Do not create or use a local `.pnpm-store`.
- Do not add `store-dir=.pnpm-store` to `.npmrc`.

If `pnpm i` is needed, run it only with escalated permissions because this project expects access to the global pnpm store.
