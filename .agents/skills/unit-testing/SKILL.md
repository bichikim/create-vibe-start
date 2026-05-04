---
name: unit-testing
description: Use when adding or updating unit tests for create-vibe-start CLI modules, especially Vitest tests that must isolate prompts, shell commands, platform detection, and package imports from real external resources.
---

# Unit Testing

## Core Rules

- Mock external resources at the import boundary: prompt packages, shell runners, command lookup, platform detection, filesystem/network access, and process exits.
- Keep unit tests focused on observable behavior: returned status objects, called command arguments, prompt choices, and CLI options.
- Simulate `gh`, `vercel`, `codex`, package managers, login flows, and network requests with mocks in unit tests.
- Prefer small fixtures and table-style cases when the same setup flow has multiple outcomes.
- Add integration tests when broader confidence is needed, and label that boundary clearly.

## File Location

- Put each unit test in a `__tests__` folder next to the file under test.
- Name the test after the target file with a `.spec.ts` suffix. Example: `foo.ts` -> `__tests__/foo.spec.ts`.
- Keep unit tests colocated with the target module under its nearest `__tests__` folder.
- Split multi-target tests into one spec per target file when each target has its own behavior.

## Vitest Pattern

- Use `vi.mock(...)` before importing the module under test when the module reads mocked imports at load time.
- Use dynamic `await import(...)` after mocks for step configuration tests.
- Reset module state with `vi.resetModules()` when testing environment-sensitive modules.
- Assert command arrays exactly so install/login regressions are easy to catch.

## Test Shape

- Utilities: verify success/failure branches by mocking their direct dependency.
- Steps: verify the setup options passed to the shared setup helper.
- Shared orchestration: cover ready, skipped, failed, install, login, and cancel-like branches.
- CLI entry: test argument handling without starting real prompts or external commands.
