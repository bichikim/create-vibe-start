# Zod 경계 검증 설계

## 목표

CLI·desktop·repair 진입점에서 받는 **구조화된 입력**을 Zod 스키마로 검증한다.  
한 줄짜리 Clack 프롬프트나 외부 API 런타임 에러는 Zod 대상이 아니다.

## 범위

### 포함

- `CreateProjectRequest` (workflow 진입)
- `DesktopProjectRequest` (desktop worker IPC JSON)
- `repair vercel` 옵션 (`--dir`, `--project-name`, `--github-repository`)
- 공유 필드 스키마 `projectName` (기존 메시지·검사 순서 유지)

### 제외

- `reset` 확인 문구, git author name/email 등 한 줄 프롬프트
- Vercel/GitHub API 실패 메시지
- 모든 `throw new Error`의 Zod화

## 의존성

- CLI 패키지에 `zod` ^4 추가 (생성된 템플릿 catalog의 zod와 별개)

## 구조

```
src/core/schemas/
  project-name.ts              # projectNameSchema + 기존 helper
  create-project-request.ts    # createProjectRequestSchema
  desktop-project-request.ts   # desktopProjectRequestSchema
  repair-vercel-options.ts     # repairVercelOptionsSchema
```

구현체는 `src/core/schemas/project-name.ts`에 두고, 기존 [`src/core/project-name.ts`](../../../src/core/project-name.ts)는 import 경로 호환용 re-export만 남긴다.

공개 타입은 `z.infer`로 정의한다.

- `CreateProjectRequest`
- `DesktopProjectRequest`
- repair 옵션 타입

## 데이터 흐름

1. **CLI `repair vercel`**  
   Commander 옵션 → `repairVercelOptionsSchema.parse()` → `deployVercelProject`
2. **Desktop worker**  
   `JSON.parse` → `desktopProjectRequestSchema.parse()` → `runDesktopProjectWorkflow`
3. **Workflow**  
   `validateCreateProjectRequest`가 내부에서 `createProjectRequestSchema.parse()` 사용  
   함수 시그니처는 유지
4. **실시간 프로젝트명 검증** (Clack / desktop UI)  
   `projectNameValidationError()`가 `safeParse`로 첫 이슈 메시지를 반환

## 에러·호환 규칙

- 기존 한국어 메시지와 검사 순서를 유지한다 (단위 테스트 계약).
- 경계에서는 `parse()`로 throw하고, 상위가 `error.message`를 출력한다.
- UI용은 `safeParse` → `issues[0]?.message`.
- `projectName`은 trim 후 검증하고, 파싱 결과는 trimmed 문자열이다.
- 교차 조건 `deployVercel && !createGithubRepository`는 object refine으로 옮기고 메시지는 그대로 둔다.
- `projectNameValidationError` / `assertValidProjectName` / `validateCreateProjectRequest` 시그니처는 유지한다.

### repair `githubRepository`

- optional
- 값이 있으면 `owner/name` 한 쌍만 허용 (`/^[^/\s]+\/[^/\s]+$/`, 슬래시 하나)

### desktop 확장 필드

- `gitAuthorName`, `gitAuthorEmail`, `templateDir`: non-empty string (trim)
- `resumeFromStep`: 기존 `WorkflowStepId` union과 동일

## 테스트

- 기존 `project-name.spec.ts`, `workflow.spec.ts` 메시지 계약 유지
- desktop worker: 잘못된 요청 shape → 스키마 메시지로 실패
- repair: 잘못된 `project-name` / `github-repository` 형식 거부
- `pnpm test`, `pnpm coverage`(100%), `pnpm typecheck` 통과

## 완료 기준

- workflow / desktop IPC / repair 세 경계가 Zod로 파싱된다
- 프롬프트·외부 API 에러 경로는 변경하지 않는다
- 공개 helper API와 기존 검증 메시지가 깨지지 않는다
