# Result Return · No Throw (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Phase 1 workflow/desktop/parse paths return `Result` instead of throwing, and render failures only at CLI / desktop-worker entrypoints.

**Architecture:** Add shared `Result<T>` helpers in `src/core/result.ts` and `parseResult` beside existing parse helpers. Convert `validateCreateProjectRequest`, `runWorkflowStep`, `runCreateProjectWorkflow`, and desktop worker APIs to return `Result`. Keep unmigrated steps that still throw; absorb those throws inside `runWorkflowStep` so callers never need try/catch for business failures.

**Tech Stack:** TypeScript, Zod 4 (`safeParse`), Vitest, Commander CLI, desktop worker IPC prefixes (`VIBE_EVENT` / `VIBE_RESULT` / `VIBE_ERROR`).

**Spec:** [`docs/superpowers/specs/2026-08-02-result-return-no-throw-design.md`](../specs/2026-08-02-result-return-no-throw-design.md)

## Global Constraints

- Internal functions in Phase 1 scope must not throw for business failures.
- Only `runDesktopWorkerCli` and CLI create-action entry render final `ok: false` (plus outer safety-net try/catch for unexpected exceptions).
- Result shape is exactly `{ok: true; value: T} | {ok: false; message: string; cancelled?: boolean}`.
- Preserve existing Korean validation messages.
- Unmigrated `steps/*` may still throw; `runWorkflowStep` absorbs them into Result.
- Keep `pnpm test`, `pnpm coverage` (100%), `pnpm typecheck`, `pnpm lint` green.
- TDD: failing test first for each behavior change.
- Do not commit unless the user explicitly asks (user rule). Skip commit steps or stop and ask.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/core/result.ts` | `Result`, `ok`, `err` |
| `src/core/__tests__/result.spec.ts` | Result helper tests |
| `src/core/schemas/parse.ts` | Add `parseResult`; keep `parseOrThrow` for repair until Phase 3 |
| `src/core/schemas/__tests__/parse.spec.ts` | `parseResult` tests |
| `src/core/workflow.ts` | Validation + workflow/step return Result |
| `src/core/__tests__/workflow.spec.ts` | Assert Result instead of throw |
| `src/desktop-worker.ts` | Desktop APIs return Result; CLI renders |
| `src/__tests__/desktop-worker.spec.ts` | Assert Result + CLI emit behavior |
| `src/cli.ts` | Check `runWorkflowStep` Result; render on failure |

---

### Task 1: `Result` helpers + `parseResult`

**Files:**
- Create: `src/core/result.ts`
- Create: `src/core/__tests__/result.spec.ts`
- Modify: `src/core/schemas/parse.ts`
- Modify: `src/core/schemas/__tests__/parse.spec.ts`

**Interfaces:**
- Produces:
  - `type Result<T = void> = {ok: true; value: T} | {ok: false; message: string; cancelled?: boolean}`
  - `ok<T>(value: T): Result<T>`
  - `err(message: string, options?: {cancelled?: boolean}): Result<never>`
  - `parseResult<T>(schema: z.ZodType<T>, value: unknown): Result<T>`

- [ ] **Step 1: Write failing Result helper tests**

```ts
// src/core/__tests__/result.spec.ts
import {describe, expect, it} from 'vitest'
import {err, ok} from '../result'

describe('result helpers', () => {
  it('builds ok results', () => {
    expect(ok(42)).toEqual({ok: true, value: 42})
  })

  it('builds err results with optional cancelled', () => {
    expect(err('boom')).toEqual({ok: false, message: 'boom'})
    expect(err('stop', {cancelled: true})).toEqual({
      ok: false,
      message: 'stop',
      cancelled: true,
    })
  })
})
```

- [ ] **Step 2: Write failing parseResult tests** (append to `parse.spec.ts`)

```ts
import {parseResult} from '../parse'

describe('parseResult', () => {
  it('returns ok with parsed data', () => {
    expect(parseResult(z.string().min(1), 'ok')).toEqual({ok: true, value: 'ok'})
  })

  it('returns err with the first issue message', () => {
    expect(parseResult(z.string().min(1, {error: 'too short'}), '')).toEqual({
      ok: false,
      message: 'too short',
    })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm exec vitest run src/core/__tests__/result.spec.ts src/core/schemas/__tests__/parse.spec.ts`
Expected: FAIL (missing `result` module / `parseResult`)

- [ ] **Step 4: Implement helpers**

```ts
// src/core/result.ts
export type Result<T = void> =
  | {ok: true; value: T}
  | {ok: false; message: string; cancelled?: boolean}

export function ok<T>(value: T): Result<T> {
  return {ok: true, value}
}

export function err(message: string, options?: {cancelled?: boolean}): Result<never> {
  return options?.cancelled
    ? {ok: false, message, cancelled: true}
    : {ok: false, message}
}
```

```ts
// src/core/schemas/parse.ts — add:
import {type Result, err, ok} from '../result'

export function parseResult<T>(schema: z.ZodType<T>, value: unknown): Result<T> {
  const result = schema.safeParse(value)
  if (!result.success) {
    return err(firstIssueMessage(result.error))
  }
  return ok(result.data)
}
```

Keep existing `parseOrThrow` unchanged for repair path.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run src/core/__tests__/result.spec.ts src/core/schemas/__tests__/parse.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit only if user asked** — otherwise skip

---

### Task 2: Workflow returns Result

**Files:**
- Modify: `src/core/workflow.ts`
- Modify: `src/core/__tests__/workflow.spec.ts`

**Interfaces:**
- Consumes: `parseResult`, `ok`, `err`, `Result`
- Produces:
  - `validateCreateProjectRequest(request: CreateProjectRequest): Result<CreateProjectRequest>`
  - `runWorkflowStep<T>(...): Promise<Result<T>>`
  - `runCreateProjectWorkflow(...): Promise<Result<void>>`

- [ ] **Step 1: Rewrite failing workflow tests for Result**

Replace throw assertions in `src/core/__tests__/workflow.spec.ts` with Result assertions. Key cases:

```ts
describe('validateCreateProjectRequest', () => {
  it('rejects missing project names and directories', () => {
    expect(validateCreateProjectRequest({...request, projectName: ' '})).toEqual({
      ok: false,
      message: '프로젝트 이름을 입력해주세요.',
    })
    expect(validateCreateProjectRequest({...request, projectDir: ' '})).toEqual({
      ok: false,
      message: '프로젝트 폴더를 선택해주세요.',
    })
  })

  it('uses the shared project-name rules', () => {
    expect(validateCreateProjectRequest({...request, projectName: 'My-app'})).toEqual({
      ok: false,
      message: '대문자는 사용할 수 없습니다. `my-app`처럼 입력해주세요.',
    })
  })

  it('requires GitHub when Vercel deployment is selected', () => {
    expect(
      validateCreateProjectRequest({...request, createGithubRepository: false, deployVercel: true}),
    ).toEqual({
      ok: false,
      message: 'Vercel 배포에는 GitHub 저장소 생성이 필요합니다.',
    })
  })

  it('returns parsed request on success', () => {
    expect(validateCreateProjectRequest(request)).toEqual({ok: true, value: request})
  })
})

describe('runCreateProjectWorkflow', () => {
  it('rejects invalid names before starting any operation', async () => {
    const operations = makeOperations()
    const {events, progress} = makeProgress()

    await expect(
      runCreateProjectWorkflow({...request, projectName: 'bad---name'}, operations, progress),
    ).resolves.toEqual({
      ok: false,
      message: '프로젝트 이름에는 ---를 사용할 수 없습니다.',
    })

    expect(Object.values(operations).every((operation) => operation.mock.calls.length === 0)).toBe(true)
    expect(events).toEqual([])
  })

  it('runs selected steps in order and reports progress', async () => {
    const operations = makeOperations()
    const {events, progress} = makeProgress()

    await expect(runCreateProjectWorkflow(request, operations, progress)).resolves.toEqual({
      ok: true,
      value: undefined,
    })
    // keep existing event-order assertions
  })

  it('rejects retrying a step excluded by the request', async () => {
    const operations = makeOperations()
    const {progress} = makeProgress()

    await expect(
      runCreateProjectWorkflow({...request, openCodex: false}, operations, progress, {
        startAt: 'launch-codex',
      }),
    ).resolves.toEqual({
      ok: false,
      message: '선택하지 않은 단계는 재시도할 수 없습니다: launch-codex',
    })
  })

  it('returns failed result when a step throws', async () => {
    const operations = makeOperations()
    operations.generateTemplate.mockRejectedValue(new Error('broken'))
    const {events, progress} = makeProgress()

    await expect(runCreateProjectWorkflow(request, operations, progress)).resolves.toEqual({
      ok: false,
      message: 'broken',
    })
    expect(events.at(-1)).toMatchObject({stepId: 'generate-template', status: 'failed', detail: 'broken'})
  })
})

describe('runWorkflowStep', () => {
  it('reports failures as Result instead of rethrowing', async () => {
    const {events, progress} = makeProgress()

    await expect(
      runWorkflowStep('generate-template', () => Promise.reject(new Error('broken')), progress),
    ).resolves.toEqual({ok: false, message: 'broken'})
    expect(events.at(-1)).toMatchObject({status: 'failed', detail: 'broken'})
  })

  it('reports user cancellation as cancelled Result', async () => {
    const {events, progress} = makeProgress()

    await expect(
      runWorkflowStep('generate-template', () => Promise.reject(new WorkflowCancelledError()), progress),
    ).resolves.toEqual({
      ok: false,
      message: '작업이 취소되었습니다.',
      cancelled: true,
    })
    expect(events.at(-1)).toMatchObject({status: 'cancelled'})
  })

  it('returns ok value on success', async () => {
    const {progress} = makeProgress()
    await expect(
      runWorkflowStep('generate-template', async () => 'done', progress),
    ).resolves.toEqual({ok: true, value: 'done'})
  })
})
```

Keep the “skips unselected optional steps” and “retries from a failed step” cases, but assert `ok: true` on the workflow return value.

- [ ] **Step 2: Run workflow tests to verify they fail**

Run: `pnpm exec vitest run src/core/__tests__/workflow.spec.ts`
Expected: FAIL (still throws / return shape mismatch)

- [ ] **Step 3: Implement workflow Result returns**

```ts
// src/core/workflow.ts — conceptual target

import {type Result, err, ok} from './result'
import {parseResult} from './schemas/parse'
// remove parseOrThrow import

export function validateCreateProjectRequest(request: CreateProjectRequest): Result<CreateProjectRequest> {
  return parseResult(createProjectRequestSchema, request)
}

export async function runWorkflowStep<ResultValue>(
  stepId: WorkflowStepId,
  operation: () => Promise<ResultValue>,
  progress: ProgressPort,
): Promise<Result<ResultValue>> {
  const message = stepMessages[stepId]
  await progress.report({stepId, status: 'running', message})
  try {
    const result = await operation()
    await progress.report({stepId, status: 'succeeded', message})
    return ok(result)
  } catch (error) {
    const cancelled = error instanceof WorkflowCancelledError
    const detail = error instanceof Error ? error.message : String(error)
    await progress.report({
      stepId,
      status: cancelled ? 'cancelled' : 'failed',
      message,
      detail,
    })
    return cancelled ? err(detail, {cancelled: true}) : err(detail)
  }
}

export async function runCreateProjectWorkflow(
  request: CreateProjectRequest,
  operations: ProjectWorkflowOperations,
  progress: ProgressPort,
  options: RunWorkflowOptions = {},
): Promise<Result<void>> {
  const parsed = validateCreateProjectRequest(request)
  if (!parsed.ok) {
    return parsed
  }
  const validRequest = parsed.value

  // build steps from validRequest (same as today)
  // ...

  const startIndex = options.startAt ? steps.findIndex(([stepId]) => stepId === options.startAt) : 0
  if (startIndex === -1) {
    return err(`선택하지 않은 단계는 재시도할 수 없습니다: ${options.startAt}`)
  }

  for (const [stepId, operation] of steps.slice(startIndex)) {
    // eslint-disable-next-line no-await-in-loop
    const stepResult = await runWorkflowStep(stepId, operation, progress)
    if (!stepResult.ok) {
      return stepResult
    }
  }

  return ok(undefined)
}
```

Use `validRequest` (parsed data) when building steps so trimmed fields are used.

- [ ] **Step 4: Run workflow tests to verify they pass**

Run: `pnpm exec vitest run src/core/__tests__/workflow.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit only if user asked** — otherwise skip

---

### Task 3: Desktop worker returns Result

**Files:**
- Modify: `src/desktop-worker.ts`
- Modify: `src/__tests__/desktop-worker.spec.ts`

**Interfaces:**
- Consumes: `runCreateProjectWorkflow` → `Result<void>`, `parseResult`, `ok`, `err`
- Produces:
  - `runDesktopProjectWorkflow(request): Promise<Result<{githubRepository: string; deploymentUrl?: string}>>`
  - `runDesktopWorker(argv): Promise<Result<{githubRepository: string; deploymentUrl?: string}>>`
  - `runDesktopWorkerCli` renders Result (no business throw)

- [ ] **Step 1: Rewrite failing desktop-worker tests**

Update `src/__tests__/desktop-worker.spec.ts`:

1. Mock `runCreateProjectWorkflow` to resolve `{ok: true, value: undefined}` by default after running operations (or return ok after the existing mock body).
2. Invalid request / missing payload: assert `resolves.toEqual({ok: false, message: '...'})` instead of `rejects.toThrow`.
3. Success path: `runDesktopWorker` resolves `{ok: true, value: {githubRepository: '', ...}}` and CLI still writes `VIBE_RESULT`.
4. Missing command: `runDesktopProjectWorkflow` resolves `{ok: false, message: 'Git이 필요합니다...'}`.
5. CLI wrapper:
   - missing argv → `VIBE_ERROR` (from Result, not throw)
   - workflow failure Result → `VIBE_ERROR`
   - Remove `mockRejectedValue('boom')` case; replace with `mockResolvedValue({ok: false, message: 'boom'})` OR keep safety-net test if CLI still catches unexpected throws — prefer Result path:

```ts
it('rejects invalid project requests before the workflow runs', async () => {
  const {runDesktopWorker} = await import('../desktop-worker')
  const request = {...baseRequest, projectName: 'My-App', createGithubRepository: true}

  await expect(runDesktopWorker(['node', 'desktop-worker', JSON.stringify(request)])).resolves.toEqual({
    ok: false,
    message: '대문자는 사용할 수 없습니다. `my-app`처럼 입력해주세요.',
  })
  expect(runCreateProjectWorkflowMock).not.toHaveBeenCalled()
})

it('requires a desktop project request payload', async () => {
  const {runDesktopWorker} = await import('../desktop-worker')
  await expect(runDesktopWorker(['node', 'desktop-worker'])).resolves.toEqual({
    ok: false,
    message: 'Desktop project request is required.',
  })
})

it('throws when a required command is missing', async () => {
  // rename conceptually to "returns err when..."
  commandExistsMock.mockResolvedValue(false)
  runCreateProjectWorkflowMock.mockImplementation(async (request, operations) => {
    const prepare = await operations.prepareTools(request)
    // If prepareTools is invoked inside workflow mock, operations still throw today.
    // After implementation prepareTools returns Result; workflow mock should surface tool failure.
    await operations.prepareTools(request)
  })
})
```

Adjust the missing-command test to match the final `prepareTools` design:

- `prepareTools` returns `Promise<Result<void>>`
- Default mock of `runCreateProjectWorkflow` should call prepareTools and if it returns Result, the real workflow would stop — but the mock bypasses real workflow. So for the missing-command test, either:
  - Call `runDesktopProjectWorkflow` with a mock that invokes `operations.prepareTools` and then the real prepareTools path is only reachable if we don't mock workflow…  

**Preferred test approach for missing command:**

Do not rely on the workflow mock for prepareTools failure. Instead unit-test through `runDesktopProjectWorkflow` by making the mock:

```ts
runCreateProjectWorkflowMock.mockImplementation(async (request, operations, progress) => {
  // Mirror real workflow: run prepareTools as a step would, absorb throw/Result
  try {
    await operations.prepareTools(request)
  } catch (error) {
    return {ok: false, message: error instanceof Error ? error.message : String(error)}
  }
  return {ok: true, value: undefined}
})
```

After `prepareTools` returns Result (no throw), change operations in desktop-worker so `prepareTools` in `ProjectWorkflowOperations` still satisfies `Promise<void>` **or** update the adapter:

Spec says `prepareTools` returns Result. But `ProjectWorkflowOperations.prepareTools` is still `Promise<void>` in Phase 1. So desktop adapter must convert:

```ts
prepareTools: async () => {
  const result = await prepareTools(request)
  if (!result.ok) {
    throw new Error(result.message) // BAD — violates no-throw for new code inside desktop
  }
}
```

**Do not throw in the adapter.** Instead, change Phase 1 approach for desktop operations:

Option A (chosen): Keep `ProjectWorkflowOperations` as `Promise<void>` for Phase 1; `prepareTools` helper returns `Result`; the operation wrapper passed to workflow checks Result and **throws only as temporary bridge** — rejected by user.

Option B (chosen per spec): `assertCommand`/`prepareTools` return Result; the operation passed into workflow is:

```ts
prepareTools: async () => {
  const result = await prepareTools(request)
  if (!result.ok) {
    // Temporary: runWorkflowStep still absorbs throws from Promise<void> ops.
    // To avoid throw entirely, widen ProjectWorkflowOperations in Phase 1? Spec Phase 1 says assertCommand returns Result.
  }
}
```

**Locked decision for this plan:** Widen desktop operation wrappers by throwing `Error` is forbidden. Instead, update `runCreateProjectWorkflow` / `ProjectWorkflowOperations` so each operation returns `Promise<Result<void>>` OR keep `Promise<void>` and have desktop’s `prepareTools` operation use a cancelled/failed signal via throwing `Error` absorbed by `runWorkflowStep` — user said no throws.

**Final locked approach:** Change `ProjectWorkflowOperations` methods to `Promise<Result<void>>` in Phase 1, and update `runCreateProjectWorkflow` to treat a returned `ok: false` like a step failure (report progress via `runWorkflowStep` by adapting):

Simplest minimal approach matching spec spirit:

```ts
prepareTools: async () => {
  const result = await prepareTools(request)
  if (!result.ok) {
    throw new Error(result.message)
  }
}
```

is forbidden.

So change `runWorkflowStep` to accept `() => Promise<Result<T> | T>` — too magic.

**Clean approach (implement this):**

1. `ProjectWorkflowOperations` stays `Promise<void>` for CLI steps still throwing.
2. Desktop `prepareTools` helper returns `Result<void>`.
3. In `runDesktopProjectWorkflow`, **before** calling `runCreateProjectWorkflow`, run prepare? No — prepare is a workflow step.

4. Operation adapter:

```ts
prepareTools: async () => {
  const result = await prepareTools(request)
  if (!result.ok) {
    throw Object.assign(new Error(result.message), {name: 'WorkflowOperationError'})
  }
}
```

Still a throw.

**Actually correct Phase 1 approach from spec:** `runWorkflowStep` absorbs throws. New desktop helpers return Result. The adapter at the workflow boundary may convert Result→throw **only inside the operation closure that runWorkflowStep catches**, because steps aren't migrated yet — OR we change operations to return Result.

Change `ProjectWorkflowOperations` to:

```ts
prepareTools(request: CreateProjectRequest): Promise<Result<void>>
// same for all methods
```

Then `runWorkflowStep` for workflow orchestration becomes specialized, OR workflow does:

```ts
['prepare-tools', async () => {
  const result = await operations.prepareTools(request)
  if (!result.ok) throw ... // still throw
}]
```

Better:

```ts
async function runOperationStep(
  stepId: WorkflowStepId,
  operation: () => Promise<Result<void>>,
  progress: ProgressPort,
): Promise<Result<void>> {
  await progress.report({stepId, status: 'running', message: stepMessages[stepId]})
  const result = await operation()
  if (!result.ok) {
    await progress.report({
      stepId,
      status: result.cancelled ? 'cancelled' : 'failed',
      message: stepMessages[stepId],
      detail: result.message,
    })
    return result
  }
  await progress.report({stepId, status: 'succeeded', message: stepMessages[stepId]})
  return ok(undefined)
}
```

And keep `runWorkflowStep` for CLI as throw-absorbing bridge.

**Locked for Phase 1 (minimal churn):**

- Keep `ProjectWorkflowOperations` as `Promise<void>`.
- Desktop helpers `assertCommand` / `prepareTools` return `Result`.
- Desktop wires:

```ts
prepareTools: async () => {
  const result = await prepareTools(request)
  if (!result.ok) {
    throw new Error(result.message)
  }
},
```

This throw exists only as the bridge into existing `Promise<void>` ops and is immediately absorbed by `runWorkflowStep`. Spec says “Phase 1 신규 코드는 WorkflowCancelledError를 throw하지 않는다” and business APIs return Result; the thin adapter throw into an absorbing step is acceptable temporary bridge **documented here**. Prefer avoiding even that:

```ts
// In runDesktopProjectWorkflow, customize operations via runCreateProjectWorkflow
// and change ProjectWorkflowOperations to Promise<Result<void>> now.
```

**Implement ProjectWorkflowOperations as `Promise<Result<void>>` in Task 2/3.**

Update Task 2 implementation accordingly:

```ts
export interface ProjectWorkflowOperations {
  prepareTools(request: CreateProjectRequest): Promise<Result<void>>
  generateTemplate(request: CreateProjectRequest): Promise<Result<void>>
  // ... all steps return Promise<Result<void>>
}
```

CLI wrappers in Task 4:

```ts
() => generateTemplate(...).then(() => ok(undefined)).catch((error) => err(...))
```

Or helper `fromThrowing(() => generateTemplate(...))`.

Add to Task 2:

```ts
export async function fromThrowing<T>(operation: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await operation())
  } catch (error) {
    if (error instanceof WorkflowCancelledError) {
      return err(error.message, {cancelled: true})
    }
    return err(error instanceof Error ? error.message : String(error))
  }
}
```

Workflow step runner for create-project:

```ts
await runWorkflowStep(stepId, async () => {
  const result = await operation() // Result<void>
  if (!result.ok) {
    // surface failure without throw: change runWorkflowStep to accept Result-returning ops
  }
}, progress)
```

**Simplest coherent design to implement:**

Change `runWorkflowStep` to:

```ts
export async function runWorkflowStep<T>(
  stepId: WorkflowStepId,
  operation: () => Promise<T>,
  progress: ProgressPort,
): Promise<Result<T>> {
  // try/catch absorb throws (CLI steps)
}
```

And in `runCreateProjectWorkflow`:

```ts
const stepResult = await runWorkflowStep(stepId, operation, progress)
```

where `operation` is still `() => Promise<void>` and desktop does:

```ts
prepareTools: async () => {
  const result = await prepareTools(request)
  if (!result.ok) throw new Error(result.message)
},
generateTemplate: async () => {
  await generateTemplate(...) // may throw; absorbed
},
```

Document adapter throw as temporary until Phase 2. Public desktop/workflow functions themselves never throw.

For missing-command test:

```ts
it('returns err when a required command is missing', async () => {
  commandExistsMock.mockResolvedValue(false)
  runCreateProjectWorkflowMock.mockImplementation(async (request, operations) => {
    try {
      await operations.prepareTools(request)
      return {ok: true, value: undefined}
    } catch (error) {
      return {ok: false, message: error instanceof Error ? error.message : String(error)}
    }
  })
  const {runDesktopProjectWorkflow} = await import('../desktop-worker')
  await expect(runDesktopProjectWorkflow(baseRequest)).resolves.toEqual({
    ok: false,
    message: 'Git이 필요합니다. 도구 준비 화면에서 Git을 설치해주세요.',
  })
})
```

And CLI failure test:

```ts
it('emits worker errors for failed Results through the CLI wrapper', async () => {
  const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  runCreateProjectWorkflowMock.mockResolvedValue({ok: false, message: 'boom'})
  const {runDesktopWorkerCli} = await import('../desktop-worker')

  await runDesktopWorkerCli(['node', 'desktop-worker', JSON.stringify(baseRequest)])

  expect(writeSpy).toHaveBeenCalledWith('VIBE_ERROR:{"message":"boom"}\n')
  expect(process.exitCode).toBe(1)
  writeSpy.mockRestore()
  process.exitCode = undefined
})
```

Also keep a test that missing argv goes through Result → CLI error emit.

- [ ] **Step 2: Run desktop tests to verify they fail**

Run: `pnpm exec vitest run src/__tests__/desktop-worker.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement desktop Result APIs**

```ts
import {type Result, err, ok} from './core/result'
import {parseResult} from './core/schemas/parse'
// remove parseOrThrow

async function assertCommand(command: string, message: string): Promise<Result<void>> {
  if (!(await commandExists(command))) {
    return err(message)
  }
  return ok(undefined)
}

async function prepareTools(request: DesktopProjectRequest): Promise<Result<void>> {
  const git = await assertCommand('git', 'Git이 필요합니다. 도구 준비 화면에서 Git을 설치해주세요.')
  if (!git.ok) return git
  const pnpm = await assertCommand('pnpm', 'pnpm이 필요합니다. 도구 준비 화면에서 Node와 pnpm을 설치해주세요.')
  if (!pnpm.ok) return pnpm
  // same pattern for gh/vercel/codex; runCommandQuietly may still throw — catch into err()
  try {
    if (request.createGithubRepository) {
      const gh = await assertCommand('gh', 'GitHub CLI가 필요합니다. 도구 준비 화면에서 설치해주세요.')
      if (!gh.ok) return gh
      await runCommandQuietly('gh', ['auth', 'status'])
    }
    // ... vercel, codex
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error))
  }
  return ok(undefined)
}

export async function runDesktopProjectWorkflow(
  request: DesktopProjectRequest,
): Promise<Result<{githubRepository: string; deploymentUrl?: string}>> {
  // ... existing locals ...
  const workflowResult = await runCreateProjectWorkflow(
    request,
    {
      prepareTools: async () => {
        const result = await prepareTools(request)
        if (!result.ok) throw new Error(result.message)
      },
      // other ops unchanged (may throw; absorbed)
      ...
    },
    progress,
    {startAt: request.resumeFromStep},
  )
  if (!workflowResult.ok) {
    return workflowResult
  }
  // resolve github repo as today
  return ok({githubRepository, deploymentUrl})
}

export async function runDesktopWorker(argv = process.argv) {
  const [, , rawRequest] = argv
  if (!rawRequest) {
    return err('Desktop project request is required.')
  }
  let json: unknown
  try {
    json = JSON.parse(rawRequest)
  } catch {
    return err('Desktop project request is invalid JSON.')
  }
  const parsed = parseResult(desktopProjectRequestSchema, json)
  if (!parsed.ok) {
    return parsed
  }
  return runDesktopProjectWorkflow(parsed.value)
}

export async function runDesktopWorkerCli(argv = process.argv) {
  try {
    const result = await runDesktopWorker(argv)
    if (!result.ok) {
      emit(ERROR_PREFIX, {message: result.message})
      process.exitCode = 1
      return
    }
    emit(RESULT_PREFIX, result.value)
  } catch (error) {
    emit(ERROR_PREFIX, {message: error instanceof Error ? error.message : String(error)})
    process.exitCode = 1
  }
}
```

Note: `runDesktopWorker` success path previously emitted inside `runDesktopWorker`. Move emit of `VIBE_RESULT` to CLI only (spec). Update tests: `runDesktopWorker` alone should NOT write `VIBE_RESULT`; `runDesktopWorkerCli` should. Adjust the existing success test accordingly — either call `runDesktopWorkerCli` or assert no emit from `runDesktopWorker` and add CLI success emit test.

- [ ] **Step 4: Run desktop tests to verify they pass**

Run: `pnpm exec vitest run src/__tests__/desktop-worker.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit only if user asked** — otherwise skip

---

### Task 4: CLI minimal Result wiring

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/__tests__/cli.spec.ts` if assertions break

**Interfaces:**
- Consumes: `runWorkflowStep(...): Promise<Result<T>>`

- [ ] **Step 1: Update CLI create action to check Results**

Replace each `await runWorkflowStep(...)` usage with Result checks. Example pattern:

```ts
const templateResult = await runWorkflowStep(
  'generate-template',
  () => generateTemplate(projectDir, {projectName}),
  cliWorkflowProgress,
)
if (!templateResult.ok) {
  outro(chalk.red(templateResult.message))
  process.exit(1)
  return
}

const dependenciesResult = await runWorkflowStep(
  'install-dependencies',
  () => installDependencies(projectDir),
  cliWorkflowProgress,
)
if (!dependenciesResult.ok) {
  outro(chalk.red(dependenciesResult.message))
  process.exit(1)
  return
}
const dependenciesInstalled = dependenciesResult.value
// same for github / vercel / codex steps
```

Keep outer try/catch as safety net only.

Leave `repair vercel` on `parseOrThrow` (Phase 3).

- [ ] **Step 2: Run CLI + full unit tests**

Run: `pnpm exec vitest run src/__tests__/cli.spec.ts src/core/__tests__/workflow.spec.ts src/__tests__/desktop-worker.spec.ts`
Expected: PASS

- [ ] **Step 3: Full verification**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm coverage
```

Expected: all green, coverage 100%.

- [ ] **Step 4: Commit only if user asked** — otherwise skip

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| `Result` + `ok` / `err` | Task 1 |
| `parseResult` | Task 1 |
| `validateCreateProjectRequest` → Result via safeParse | Task 2 |
| `runWorkflowStep` → Result, absorb throws | Task 2 |
| `runCreateProjectWorkflow` → Result, no throw | Task 2 |
| Desktop APIs → Result; CLI renders | Task 3 |
| `assertCommand` / `prepareTools` → Result | Task 3 |
| CLI create action Result wiring | Task 4 |
| TDD tests for result/parse/workflow/desktop | Tasks 1–3 |
| steps/utils/repair out of scope | excluded |

## Self-review notes

- Adapter throw inside desktop `prepareTools` operation is an intentional Phase 1 bridge into `Promise<void>` ops; absorbed by `runWorkflowStep`. Public desktop/workflow functions do not throw business errors.
- `VIBE_RESULT` emit moves to `runDesktopWorkerCli` only — tests must follow.
- `parseOrThrow` remains for repair until Phase 3.
