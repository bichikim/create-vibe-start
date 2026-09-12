# Result 반환 · throw 제거 설계

## 목표

프로젝트 내부 함수는 실패를 **throw하지 않고** `Result`로 반환한다.  
에러 렌더링(빨간 메시지 / `VIBE_ERROR` / `process.exitCode`)은 **CLI·desktop-worker 진입점**에서 최종 결과만 보고 수행한다.

이전 Zod 경계 설계([`2026-08-02-zod-boundary-validation-design.md`](./2026-08-02-zod-boundary-validation-design.md))의 “경계에서 `parse()`로 throw” 규칙은 이 설계로 대체한다.

## 원칙

1. 도메인·워크플로·step·유틸 함수는 `throw`하지 않는다.
2. 호출자는 `ok`를 분기해 계속하거나 상위 Result로 올린다.
3. 예외 허용 지점: `runCli` / `runDesktopWorkerCli`(및 동등한 최상위 진입)에서만 최종 `ok: false`를 렌더링한다.
4. 예상치 못한 인프라 예외(예: Node 내부)가 새어 나올 경우를 위한 최상위 안전망 try/catch는 허용하되, 의도된 비즈니스 실패 경로에는 쓰지 않는다.

## 공유 타입

```ts
export type Result<T = void> =
  | {ok: true; value: T}
  | {ok: false; message: string; cancelled?: boolean}
```

위치: `src/core/result.ts` (신규)

헬퍼(최소):

- `ok(value)` / `err(message, options?)`
- `parseResult(schema, value)` — `safeParse` + `firstIssueMessage` → `Result<T>`
- `parseOrThrow`는 Phase 1에서 Phase 1 경로 사용을 제거하고, 전 경로 이전 후 삭제한다.

## Phase 1 범위 (이번 작업)

### 포함

| 모듈 | 변경 |
|---|---|
| `src/core/result.ts` | `Result` + `ok` / `err` |
| `src/core/schemas/parse.ts` | `parseResult` 추가; Phase 1 호출부는 `parseOrThrow` 대신 사용 |
| `src/core/workflow.ts` | `validateCreateProjectRequest` → Result; `runWorkflowStep` → Result; `runCreateProjectWorkflow` → Result; throw 제거 |
| `src/desktop-worker.ts` | `runDesktopProjectWorkflow` / `runDesktopWorker` → Result; CLI만 최종 렌더 |
| 관련 단위 테스트 | `rejects.toThrow` → `ok: false` assert; 성공 경로 `ok: true` |

### 제외 (Phase 2+)

- `steps/*` (`install-dependencies`, `deploy-vercel-project`, `create-github-repository`, `generate-template` 등) — 시그니처는 throw 유지
- `utils/*` (`network-retry`, `run-command`)
- `assertValidProjectName` / CLI `repair`의 `parseOrThrow` (Phase 3)
- `cli.ts` step 오케스트레이션 전면 재작성

### `cli.ts` Phase 1 최소 배선 (명시)

`runWorkflowStep`이 Result를 반환하므로 create action은 각 호출 후:

1. `ok: false`이면 `outro(chalk.red(result.message))` + `process.exit(1)` (또는 동일 렌더 헬퍼)
2. `ok: true`이면 `result.value`로 계속

의도된 실패 경로에서 `throw`로 catch 블록에 맡기지 않는다. 기존 바깥 try/catch는 예상 밖 예외 안전망으로만 남긴다.

## Phase 1 API

### `validateCreateProjectRequest(request)`

```ts
Result<CreateProjectRequest>
// 내부: createProjectRequestSchema.safeParse → parseResult / firstIssueMessage
```

### `runWorkflowStep(stepId, operation, progress)`

```ts
Promise<Result<T>>
```

- 성공 시 progress `succeeded`, `{ok: true, value}`
- Phase 1: `operation`은 아직 throw할 수 있다(미이전 steps). 그 throw는 catch해 progress `failed`/`cancelled` + `{ok: false, ...}`로 흡수한다.
- `WorkflowCancelledError` 인스턴스 throw → `{ok: false, cancelled: true, message}`. Phase 1 신규 코드는 이 에러를 throw하지 않는다. 클래스는 하위 호환·감지용으로 유지한다.

### `runCreateProjectWorkflow(...)`

```ts
Result<void>
```

실패 원인:

- validation 실패
- 요청에 없는 `startAt`
- step 실패 / 취소

성공: `{ok: true, value: undefined}`

### Desktop

```ts
runDesktopProjectWorkflow(request): Promise<Result<{githubRepository: string; deploymentUrl?: string}>>
runDesktopWorker(argv): Promise<Result<{githubRepository: string; deploymentUrl?: string}>>
```

- 요청 파싱: `desktopProjectRequestSchema` + `parseResult` (throw 없음)
- `runDesktopWorkerCli`: `ok: false` → `VIBE_ERROR` + `exitCode = 1`; `ok: true` → `VIBE_RESULT`

`assertCommand` / `prepareTools`는 Phase 1에서 Result를 반환한다. 실패 시 throw하지 않고 `{ok: false, message}`를 올린다.

## 테스트 (필수)

TDD: 실패하는 테스트를 먼저 작성한 뒤 구현한다.

### `result` / `parse`

- `ok` / `err` 형태
- `parseResult` 성공·실패(첫 이슈 메시지)

### `workflow`

- validation 실패 → `{ok: false, message}` , operation 미호출, 이벤트 없음
- 정상 실행 → `{ok: true}`, 이벤트 순서 유지
- 잘못된 `startAt` → `{ok: false, message}`
- step throw → workflow `{ok: false}`, progress `failed`
- `WorkflowCancelledError`(또는 동등 취소) → `{ok: false, cancelled: true}`

### `desktop-worker`

- 잘못된 JSON 요청 → `{ok: false, message}` (throw 아님)
- 요청 누락 → `{ok: false, message}`
- 성공 → `{ok: true, value: {...}}` + CLI는 `VIBE_RESULT`
- workflow/tool 실패 → Result 실패; CLI는 `VIBE_ERROR`

## 이후 Phase (참고)

| Phase | 범위 |
|---|---|
| 2 | steps Result화 |
| 3 | utils + `cli.ts` 전면 Result 소비 + `parseOrThrow`/`assertValidProjectName` 정리 |
| 4 | 테스트·커버리지 정리, throw 잔존 감사 |

## 비목표 (Phase 1)

- steps/utils 전면 리팩터
- Result 모나드 체이닝 라이브러리 도입
- 성공 값 래핑 방식의 과도한 일반화 (`value: undefined` 허용)
