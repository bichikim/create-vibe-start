# Improvement Log

## Done: Add a JSON Schema for the template manifest

Status: done

Changed `templates/template-manifest.json` to `{ "$schema", "files" }`, added `templates/template-manifest.schema.json`, and updated `generateTemplate` to read `manifest.files`.

## Done: Add Vercel setup repair for partial failures

Status: done

Added `create-vibe-start repair vercel` for recovering Vercel/Turso setup on an existing generated project, with `.vercel/project.json` reuse and mocked tests.

## Backlog: Validate template manifest entries at runtime

Status: paused

The CLI still reads `templates/template-manifest.json` with `JSON.parse` and casts the result to the expected TypeScript shape. If the packaged manifest is malformed, missing `files`, has an invalid entry, or points at a missing source path, the user may still see a lower-level copy/stat/plop failure during `generateTemplate`.

Paused because `template-manifest.json` is an internal packaged file, not user-authored input. Runtime validation is likely unnecessary as long as tests cover the manifest before release.

Suggested implementation when resumed:

- Add focused manifest validation inside `src/steps/generate-template.ts` using small shape checks.
- Check that the parsed manifest is an object with a `files` array.
- Check each entry has a non-empty string `from`.
- Check optional `to` is a non-empty string when present.
- Check optional `template` is a boolean when present.
- Do not add a schema validation dependency for this small shape.
- Add Vitest coverage for invalid manifest shape and invalid entries.

## Done: Provision pnpm with Corepack

Status: done

Removed the `npm i` fallback. If `pnpm` is missing, `installDependencies` now uses Corepack to activate `pnpm@11.1.2`, then runs `pnpm i`.

## Done: Add Vitest coverage and fill priority test gaps

Status: done

Added `@vitest/coverage-v8`, `pnpm coverage`, 100% coverage thresholds, ignored generated `coverage/`, and filled priority test gaps.

## Done: Add PR CI for quality gates

Status: done

Added a pull request workflow that runs `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm coverage`, and `pnpm build`.
