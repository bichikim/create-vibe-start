# Zod Boundary Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate structured inputs at workflow, desktop IPC, and repair boundaries with Zod while keeping existing Korean messages and public helper APIs.

**Architecture:** Add `zod` to the CLI package. Put schemas under `src/core/schemas/`. Keep `projectNameValidationError` / `assertValidProjectName` / `validateCreateProjectRequest` signatures. Never throw raw `ZodError` at these boundaries — always `throw new Error(issues[0].message)` so existing `toThrow('…')` contracts stay green.

**Tech Stack:** Zod 4, Vitest, TypeScript, Commander CLI, Tauri desktop worker.

## Global Constraints

- Zod only at structured boundaries: `CreateProjectRequest`, `DesktopProjectRequest`, repair vercel options.
- Do not Zod-ify one-line Clack prompts or external API errors.
- Preserve exact Korean validation messages and check order from `project-name.spec.ts` / `workflow.spec.ts`.
- `src/core/project-name.ts` becomes a re-export; implementation lives in `src/core/schemas/project-name.ts`.
- Public types use `z.infer` where the schema owns the shape.
- `pnpm i` requires escalated permissions and the global pnpm store (no local `.pnpm-store`).
- Keep `pnpm test`, `pnpm coverage` (100%), `pnpm typecheck` green.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/core/schemas/parse.ts` | `firstIssueMessage` + `parseOrThrow` helpers |
| `src/core/schemas/project-name.ts` | `projectNameSchema` + existing helpers |
| `src/core/schemas/create-project-request.ts` | `createProjectRequestSchema` + `CreateProjectRequest` type |
| `src/core/schemas/desktop-project-request.ts` | desktop IPC schema + type |
| `src/core/schemas/repair-vercel-options.ts` | repair CLI options schema + type |
| `src/core/project-name.ts` | re-export for import compatibility |
| `src/core/workflow.ts` | import request type/schema; thin validate wrapper |
| `src/desktop-worker.ts` | parse argv JSON with desktop schema |
| `src/cli.ts` | parse repair options with repair schema |
| `src/core/__tests__/project-name.spec.ts` | keep existing cases (import path unchanged) |
| `src/core/schemas/__tests__/repair-vercel-options.spec.ts` | new |
| `src/__tests__/desktop-worker.spec.ts` | new |

---

### Task 1: Add zod and shared parse helpers

**Files:**
- Modify: `package.json`
- Create: `src/core/schemas/parse.ts`
- Create: `src/core/schemas/__tests__/parse.spec.ts`

**Interfaces:**
- Produces:
  - `firstIssueMessage(error: z.ZodError): string`
  - `parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T` — throws `Error` with first issue message

- [ ] **Step 1: Install zod with escalated permissions**

```bash
pnpm add zod@^4.2.0
```

Expected: `package.json` lists `zod` under `dependencies`.

- [ ] **Step 2: Write failing helper tests**

```ts
// src/core/schemas/__tests__/parse.spec.ts
import {describe, expect, it} from 'vitest'
import {z} from 'zod'
import {firstIssueMessage, parseOrThrow} from '../parse'

describe('parseOrThrow', () => {
  it('returns parsed data', () => {
    expect(parseOrThrow(z.string().min(1), 'ok')).toBe('ok')
  })

  it('throws Error with the first issue message, not ZodError', () => {
    expect(() => parseOrThrow(z.string().min(1, {error: 'too short'}), '')).toThrow('too short')
    try {
      parseOrThrow(z.string().min(1, {error: 'too short'}), '')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect(error).not.toBeInstanceOf(z.ZodError)
    }
  })
})

describe('firstIssueMessage', () => {
  it('reads the first issue message', () => {
    const result = z.string().min(1, {error: 'required'}).safeParse('')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(firstIssueMessage(result.error)).toBe('required')
    }
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm exec vitest run src/core/schemas/__tests__/parse.spec.ts`
Expected: FAIL (module not found)

- [ ] **Step 4: Implement helpers**

```ts
// src/core/schemas/parse.ts
import {type z, ZodError} from 'zod'

export function firstIssueMessage(error: ZodError): string {
  return error.issues[0]?.message ?? error.message
}

export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new Error(firstIssueMessage(result.error))
  }
  return result.data
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm exec vitest run src/core/schemas/__tests__/parse.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/core/schemas/parse.ts src/core/schemas/__tests__/parse.spec.ts
git commit -m "$(cat <<'EOF'
Add zod and shared schema parse helpers.

EOF
)"
```

---

### Task 2: Move project-name validation onto Zod

**Files:**
- Create: `src/core/schemas/project-name.ts`
- Modify: `src/core/project-name.ts` (re-export only)
- Test: `src/core/__tests__/project-name.spec.ts` (keep cases; imports stay on `../project-name`)

**Interfaces:**
- Consumes: `firstIssueMessage` from `./parse`
- Produces:
  - `projectNameSchema: z.ZodType<string>`
  - `projectNameValidationError(value: string): string | undefined`
  - `assertValidProjectName(value: string): void`

- [ ] **Step 1: Confirm existing tests still define the contract**

Run: `pnpm exec vitest run src/core/__tests__/project-name.spec.ts`
Expected: PASS against current imperative implementation.

- [ ] **Step 2: Implement Zod-backed schema with the same message order**

```ts
// src/core/schemas/project-name.ts
import {z} from 'zod'
import {firstIssueMessage} from './parse'

const maximumProjectNameLength = 100

export const projectNameSchema = z.string().trim().superRefine((projectName, ctx) => {
  if (!projectName) {
    ctx.addIssue({code: 'custom', message: '프로젝트 이름을 입력해주세요.', fatal: true})
    return z.NEVER
  }
  if (projectName.length > maximumProjectNameLength) {
    ctx.addIssue({code: 'custom', message: '프로젝트 이름은 100자 이하여야 합니다.', fatal: true})
    return z.NEVER
  }
  if (/[A-Z]/u.test(projectName)) {
    ctx.addIssue({
      code: 'custom',
      message: `대문자는 사용할 수 없습니다. \`${projectName.toLowerCase()}\`처럼 입력해주세요.`,
      fatal: true,
    })
    return z.NEVER
  }
  if (!/^[a-z0-9]/u.test(projectName)) {
    ctx.addIssue({
      code: 'custom',
      message: '프로젝트 이름의 첫 글자는 소문자나 숫자여야 합니다.',
      fatal: true,
    })
    return z.NEVER
  }
  if (projectName.includes('---')) {
    ctx.addIssue({code: 'custom', message: '프로젝트 이름에는 ---를 사용할 수 없습니다.', fatal: true})
    return z.NEVER
  }
  if (!/^[a-z0-9._-]+$/u.test(projectName)) {
    ctx.addIssue({
      code: 'custom',
      message: '프로젝트 이름에는 소문자, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다.',
      fatal: true,
    })
    return z.NEVER
  }
})

/** Returns the shared project-name validation message used by every entry point. */
export function projectNameValidationError(value: string): string | undefined {
  const result = projectNameSchema.safeParse(value)
  if (result.success) {
    return undefined
  }
  return firstIssueMessage(result.error)
}

/** Rejects invalid project names before files or external services are changed. */
export function assertValidProjectName(value: string) {
  const error = projectNameValidationError(value)
  if (error) {
    throw new Error(error)
  }
}
```

- [ ] **Step 3: Replace `src/core/project-name.ts` with re-exports**

```ts
export {
  assertValidProjectName,
  projectNameSchema,
  projectNameValidationError,
} from './schemas/project-name'
```

- [ ] **Step 4: Run project-name tests**

Run: `pnpm exec vitest run src/core/__tests__/project-name.spec.ts`
Expected: PASS (all table cases unchanged)

- [ ] **Step 5: Commit**

```bash
git add src/core/schemas/project-name.ts src/core/project-name.ts
git commit -m "$(cat <<'EOF'
Validate project names with a shared Zod schema.

EOF
)"
```

---

### Task 3: CreateProjectRequest schema + workflow wiring

**Files:**
- Create: `src/core/schemas/create-project-request.ts`
- Modify: `src/core/workflow.ts`
- Test: `src/core/__tests__/workflow.spec.ts` (existing cases must keep passing)

**Interfaces:**
- Consumes: `projectNameSchema`, `parseOrThrow`
- Produces:
  - `createProjectRequestSchema`
  - `type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>`
  - `validateCreateProjectRequest(request: CreateProjectRequest): void`

- [ ] **Step 1: Add schema module**

```ts
// src/core/schemas/create-project-request.ts
import {z} from 'zod'
import {projectNameSchema} from './project-name'

export const createProjectRequestSchema = z
  .object({
    projectName: projectNameSchema,
    projectDir: z
      .string()
      .trim()
      .min(1, {error: '프로젝트 폴더를 선택해주세요.'}),
    createGithubRepository: z.boolean(),
    deployVercel: z.boolean(),
    openCodex: z.boolean(),
    startDevServer: z.boolean(),
  })
  .refine((value) => !(value.deployVercel && !value.createGithubRepository), {
    error: 'Vercel 배포에는 GitHub 저장소 생성이 필요합니다.',
  })

export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>
```

- [ ] **Step 2: Wire workflow.ts**

- Remove hand-written `CreateProjectRequest` type.
- Import type from `./schemas/create-project-request`.
- Replace `validateCreateProjectRequest` body:

```ts
import {createProjectRequestSchema} from './schemas/create-project-request'
import {parseOrThrow} from './schemas/parse'
import type {CreateProjectRequest} from './schemas/create-project-request'

export type {CreateProjectRequest}

export function validateCreateProjectRequest(request: CreateProjectRequest) {
  parseOrThrow(createProjectRequestSchema, request)
}
```

Keep all other workflow exports unchanged. Remove the `assertValidProjectName` import if unused.

- [ ] **Step 3: Run workflow + project-name tests**

Run: `pnpm exec vitest run src/core/__tests__/workflow.spec.ts src/core/__tests__/project-name.spec.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/core/schemas/create-project-request.ts src/core/workflow.ts
git commit -m "$(cat <<'EOF'
Parse create-project requests with Zod at the workflow boundary.

EOF
)"
```

---

### Task 4: DesktopProjectRequest schema + worker parse

**Files:**
- Create: `src/core/schemas/desktop-project-request.ts`
- Modify: `src/desktop-worker.ts`
- Create: `src/__tests__/desktop-worker.spec.ts`

**Interfaces:**
- Consumes: `createProjectRequestSchema`, `parseOrThrow`
- Produces:
  - `desktopProjectRequestSchema`
  - `type DesktopProjectRequest = z.infer<typeof desktopProjectRequestSchema>`
  - `runDesktopWorker` rejects invalid JSON shapes before workflow starts

- [ ] **Step 1: Write failing worker tests**

```ts
// src/__tests__/desktop-worker.spec.ts
import {beforeEach, describe, expect, it, vi} from 'vitest'

const runCreateProjectWorkflowMock = vi.hoisted(() => vi.fn())

vi.mock('../core/workflow', async () => {
  const actual = await vi.importActual<typeof import('../core/workflow')>('../core/workflow')
  return {
    ...actual,
    runCreateProjectWorkflow: runCreateProjectWorkflowMock,
  }
})

vi.mock('../steps/create-github-repository', () => ({createGitHubRepository: vi.fn()}))
vi.mock('../steps/deploy-vercel-project', () => ({deployVercelProject: vi.fn()}))
vi.mock('../steps/generate-template', () => ({generateTemplate: vi.fn()}))
vi.mock('../steps/install-dependencies', () => ({installDependencies: vi.fn()}))
vi.mock('../utils/command-exists', () => ({commandExists: vi.fn().mockResolvedValue(true)}))
vi.mock('../utils/run-command', () => ({
  runCommandInBackground: vi.fn(),
  runCommandQuietly: vi.fn().mockResolvedValue({stdout: 'owner/repo', stderr: '', exitCode: 0}),
}))

describe('runDesktopWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    runCreateProjectWorkflowMock.mockResolvedValue(undefined)
  })

  it('rejects invalid project requests before the workflow runs', async () => {
    const {runDesktopWorker} = await import('../desktop-worker')
    const request = {
      projectName: 'My-App',
      projectDir: '/tmp/app',
      createGithubRepository: true,
      deployVercel: false,
      openCodex: false,
      startDevServer: false,
      gitAuthorName: 'Vibe',
      gitAuthorEmail: 'vibe@example.com',
      templateDir: '/templates',
    }

    await expect(runDesktopWorker(['node', 'desktop-worker', JSON.stringify(request)])).rejects.toThrow(
      '대문자는 사용할 수 없습니다. `my-app`처럼 입력해주세요.',
    )
    expect(runCreateProjectWorkflowMock).not.toHaveBeenCalled()
  })

  it('parses a valid request and runs the workflow', async () => {
    const {runDesktopWorker} = await import('../desktop-worker')
    const request = {
      projectName: 'my-app',
      projectDir: '/tmp/app',
      createGithubRepository: false,
      deployVercel: false,
      openCodex: false,
      startDevServer: false,
      gitAuthorName: 'Vibe',
      gitAuthorEmail: 'vibe@example.com',
      templateDir: '/templates',
    }

    await runDesktopWorker(['node', 'desktop-worker', JSON.stringify(request)])
    expect(runCreateProjectWorkflowMock).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/desktop-worker.spec.ts`
Expected: FAIL — invalid name currently reaches workflow (or cast bypasses schema)

- [ ] **Step 3: Implement schema + wire worker**

```ts
// src/core/schemas/desktop-project-request.ts
import {z} from 'zod'
import {createProjectRequestSchema} from './create-project-request'

const workflowStepIdSchema = z.enum([
  'prepare-tools',
  'generate-template',
  'install-dependencies',
  'create-github-repository',
  'deploy-vercel',
  'launch-codex',
  'start-dev-server',
])

export const desktopProjectRequestSchema = createProjectRequestSchema.and(
  z.object({
    gitAuthorName: z.string().trim().min(1, {error: '이름을 입력해주세요.'}),
    gitAuthorEmail: z
      .string()
      .trim()
      .refine((value) => value.includes('@'), {error: '이메일을 입력해주세요.'}),
    templateDir: z.string().trim().min(1, {error: '템플릿 경로가 필요합니다.'}),
    resumeFromStep: workflowStepIdSchema.optional(),
  }),
)

export type DesktopProjectRequest = z.infer<typeof desktopProjectRequestSchema>
```

In `src/desktop-worker.ts`:

```ts
import {desktopProjectRequestSchema, type DesktopProjectRequest} from './core/schemas/desktop-project-request'
import {parseOrThrow} from './core/schemas/parse'

// remove local DesktopProjectRequest type alias

export async function runDesktopWorker(argv = process.argv) {
  const [, , rawRequest] = argv
  if (!rawRequest) {
    throw new Error('Desktop project request is required.')
  }

  const request = parseOrThrow(desktopProjectRequestSchema, JSON.parse(rawRequest))
  const result = await runDesktopProjectWorkflow(request)
  emit(RESULT_PREFIX, result)
}
```

Keep `runDesktopProjectWorkflow(request: DesktopProjectRequest)` signature; import the type from the schema module.

- [ ] **Step 4: Run desktop-worker tests**

Run: `pnpm exec vitest run src/__tests__/desktop-worker.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/schemas/desktop-project-request.ts src/desktop-worker.ts src/__tests__/desktop-worker.spec.ts
git commit -m "$(cat <<'EOF'
Validate desktop worker IPC payloads with Zod.

EOF
)"
```

---

### Task 5: Repair vercel options schema + CLI wiring

**Files:**
- Create: `src/core/schemas/repair-vercel-options.ts`
- Create: `src/core/schemas/__tests__/repair-vercel-options.spec.ts`
- Modify: `src/cli.ts`
- Modify: `src/__tests__/cli.spec.ts` (add invalid-name + bad-repo cases)

**Interfaces:**
- Consumes: `projectNameSchema`, `parseOrThrow`
- Produces:
  - `repairVercelOptionsSchema`
  - `type RepairVercelOptions = z.infer<typeof repairVercelOptionsSchema>`

- [ ] **Step 1: Write schema tests**

```ts
// src/core/schemas/__tests__/repair-vercel-options.spec.ts
import {describe, expect, it} from 'vitest'
import {parseOrThrow} from '../parse'
import {repairVercelOptionsSchema} from '../repair-vercel-options'

describe('repairVercelOptionsSchema', () => {
  it('accepts valid options', () => {
    expect(
      parseOrThrow(repairVercelOptionsSchema, {
        dir: '/repo',
        projectName: 'my-app',
        githubRepository: 'owner/name',
      }),
    ).toEqual({
      dir: '/repo',
      projectName: 'my-app',
      githubRepository: 'owner/name',
    })
  })

  it('rejects invalid project names', () => {
    expect(() =>
      parseOrThrow(repairVercelOptionsSchema, {dir: '/repo', projectName: 'My-app'}),
    ).toThrow('대문자는 사용할 수 없습니다. `my-app`처럼 입력해주세요.')
  })

  it('rejects malformed github repositories', () => {
    expect(() =>
      parseOrThrow(repairVercelOptionsSchema, {
        dir: '/repo',
        projectName: 'my-app',
        githubRepository: 'not-a-repo',
      }),
    ).toThrow('GitHub 저장소는 owner/name 형식이어야 합니다.')
  })
})
```

- [ ] **Step 2: Implement schema**

```ts
// src/core/schemas/repair-vercel-options.ts
import {z} from 'zod'
import {projectNameSchema} from './project-name'

export const repairVercelOptionsSchema = z.object({
  dir: z.string().trim().min(1, {error: '프로젝트 폴더를 선택해주세요.'}),
  projectName: projectNameSchema,
  githubRepository: z
    .string()
    .trim()
    .regex(/^[^/\s]+\/[^/\s]+$/u, {error: 'GitHub 저장소는 owner/name 형식이어야 합니다.'})
    .optional(),
})

export type RepairVercelOptions = z.infer<typeof repairVercelOptionsSchema>
```

Note: Commander may omit `githubRepository` as `undefined`. Schema must accept missing key. If Commander passes empty string, either preprocess empty → undefined or let regex fail — prefer:

```ts
githubRepository: z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z
    .string()
    .trim()
    .regex(/^[^/\s]+\/[^/\s]+$/u, {error: 'GitHub 저장소는 owner/name 형식이어야 합니다.'})
    .optional(),
),
```

- [ ] **Step 3: Wire cli.ts**

```ts
import {parseOrThrow} from './core/schemas/parse'
import {repairVercelOptionsSchema, type RepairVercelOptions} from './core/schemas/repair-vercel-options'

// remove local RepairOptions type; use RepairVercelOptions

.action(async (options: RepairVercelOptions) => {
  try {
    const parsed = parseOrThrow(repairVercelOptionsSchema, options)
    await deployVercelProject(parsed.dir, parsed.projectName, {
      githubRepository: parsed.githubRepository,
    })
    // ...
  }
})
```

- [ ] **Step 4: Extend cli.spec.ts**

Add a case that runs repair with `--project-name My-app` and expects outro to receive the uppercase Korean message and `process.exit(1)`. Keep the existing happy-path repair test green.

- [ ] **Step 5: Run tests**

Run: `pnpm exec vitest run src/core/schemas/__tests__/repair-vercel-options.spec.ts src/__tests__/cli.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/schemas/repair-vercel-options.ts src/core/schemas/__tests__/repair-vercel-options.spec.ts src/cli.ts src/__tests__/cli.spec.ts
git commit -m "$(cat <<'EOF'
Validate repair vercel CLI options with Zod.

EOF
)"
```

---

### Task 6: Full verification

**Files:** none new

- [ ] **Step 1: Run full suite**

```bash
pnpm typecheck
pnpm test
pnpm coverage
```

Expected: all pass, coverage statements/branches/functions/lines at 100%.

- [ ] **Step 2: Fix any coverage gaps** in schema modules / desktop-worker branches only — no speculative refactors.

- [ ] **Step 3: Final commit if fixes landed**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Close coverage gaps for Zod boundary validation.

EOF
)"
```

---

## Spec Coverage Check

| Spec requirement | Task |
| --- | --- |
| zod ^4 dependency | Task 1 |
| projectName schema + helpers + re-export | Task 2 |
| CreateProjectRequest schema / validateCreateProjectRequest | Task 3 |
| Desktop IPC parse | Task 4 |
| repair vercel options | Task 5 |
| Preserve messages / public APIs | Tasks 2–5 |
| Exclude prompts & API errors | Global Constraints (no tasks touch them) |
| tests + 100% coverage | Tasks 1–6 |
