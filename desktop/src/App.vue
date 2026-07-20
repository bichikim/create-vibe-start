<script setup lang="ts">
import {computed, onMounted, onUnmounted, shallowRef, watch} from 'vue'
import {invoke} from '@tauri-apps/api/core'
import {listen, type UnlistenFn} from '@tauri-apps/api/event'
import {getCurrentWindow} from '@tauri-apps/api/window'
import {join} from '@tauri-apps/api/path'
import {open} from '@tauri-apps/plugin-dialog'
import {openUrl} from '@tauri-apps/plugin-opener'
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
  CheckboxIndicator,
  CheckboxRoot,
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
  Label,
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from 'reka-ui'
import type {CreateProjectRequest, ToolId, WorkflowEvent, WorkflowStepId} from '../../src/core/workflow'
import {projectNameValidationError} from '../../src/core/project-name'
import {
  applyWorkflowEvent,
  areRequiredToolsReady,
  type AuthenticationPrompt,
  canStartProject,
  normalizeDeploymentUrl,
  parseAuthenticationPrompt,
  redactLog,
  requiredToolIds,
  type StepView,
  workflowStepOrder,
} from './workflow-state'

type ToolStatus = {
  tool: ToolId
  installed: boolean
  authenticated: boolean | null
  version: string | null
  message: string
}

type OutputEvent = {
  executionId: string
  stream: 'stdout' | 'stderr'
  text: string
}

type DesktopResult = {
  githubRepository?: string
  deploymentUrl?: string
}

type LifecycleEvent = {executionId: string; exitCode: number | null}

const toolLabels: Record<ToolId, string> = {
  git: 'Git',
  gh: 'GitHub',
  node: 'Node.js',
  pnpm: 'pnpm',
  vercel: 'Vercel',
  codex: 'Codex',
}
const maximumLogLines = 500

const tools = shallowRef<ToolStatus[]>([])
const loadingTools = shallowRef(true)
const busyTool = shallowRef<ToolId | null>(null)
const projectName = shallowRef('my-vibe-app')
const parentDir = shallowRef('')
const gitAuthorName = shallowRef('')
const gitAuthorEmail = shallowRef('')
const createGithubRepository = shallowRef(true)
const deployVercel = shallowRef(true)
const openCodex = shallowRef(true)
const startDevServer = shallowRef(false)
const running = shallowRef(false)
const steps = shallowRef<StepView[]>([])
const logs = shallowRef<string[]>([])
const errorMessage = shallowRef('')
const result = shallowRef<DesktopResult | null>(null)
const activeExecutionId = shallowRef<string | null>(null)
const closeConfirmationVisible = shallowRef(false)
const logsExpanded = shallowRef(false)
const cancellationRequested = shallowRef(false)
const authenticationPrompt = shallowRef<AuthenticationPrompt | null>(null)
const unlisteners: UnlistenFn[] = []

const requiredToolsReady = computed(() => {
  const required = requiredToolIds({
    createGithubRepository: createGithubRepository.value,
    deployVercel: deployVercel.value,
    openCodex: openCodex.value,
  })
  return areRequiredToolsReady(required, tools.value)
})

const canSubmit = computed(() =>
  canStartProject({
    running: running.value,
    projectName: projectName.value,
    parentDir: parentDir.value,
    createGithubRepository: createGithubRepository.value,
    gitAuthorName: gitAuthorName.value,
    gitAuthorEmail: gitAuthorEmail.value,
    toolsReady: requiredToolsReady.value,
  }),
)
const projectNameError = computed(() => projectNameValidationError(projectName.value))

const successful = computed(() => steps.value.length > 0 && steps.value.every(({status}) => status === 'succeeded'))
const failedStep = computed(() => steps.value.find(({status}) => status === 'failed'))

watch(createGithubRepository, (enabled) => {
  if (!enabled) {
    deployVercel.value = false
  }
})

async function inspectTools() {
  loadingTools.value = true
  try {
    tools.value = await invoke<ToolStatus[]>('inspect_tools')
  } finally {
    loadingTools.value = false
  }
}

async function runToolAction(tool: ToolId, action: 'install' | 'login') {
  busyTool.value = tool
  errorMessage.value = ''
  try {
    await invoke('run_tool_action', {tool, action})
    await inspectTools()
  } catch (error) {
    errorMessage.value = String(error)
  } finally {
    busyTool.value = null
  }
}

async function chooseParentDirectory() {
  const selected = await open({directory: true, multiple: false, title: '프로젝트를 저장할 폴더 선택'})
  if (typeof selected === 'string') {
    await invoke('authorize_project_root', {parentDir: selected})
    parentDir.value = selected
  }
}

function appendLog(text: string) {
  const prompt = parseAuthenticationPrompt(text)
  if (prompt) {
    authenticationPrompt.value = {...authenticationPrompt.value, ...prompt}
  }
  const sanitized = redactLog(text).trim()
  if (sanitized) {
    logs.value = [...logs.value.slice(-(maximumLogLines - 1)), sanitized]
  }
}

async function createProject(resumeFromStep?: WorkflowStepId) {
  if (!canSubmit.value) {
    return
  }

  const resolvedProjectDir = await join(parentDir.value.trim(), projectName.value.trim())
  const request: CreateProjectRequest & {
    gitAuthorName: string
    gitAuthorEmail: string
    resumeFromStep?: WorkflowStepId
  } = {
    projectName: projectName.value.trim(),
    projectDir: resolvedProjectDir,
    createGithubRepository: createGithubRepository.value,
    deployVercel: deployVercel.value,
    openCodex: openCodex.value,
    startDevServer: startDevServer.value,
    gitAuthorName: gitAuthorName.value.trim(),
    gitAuthorEmail: gitAuthorEmail.value.trim(),
    ...(resumeFromStep ? {resumeFromStep} : {}),
  }

  running.value = true
  if (resumeFromStep) {
    const startIndex = workflowStepOrder.indexOf(resumeFromStep)
    steps.value = steps.value.filter(({stepId}) => workflowStepOrder.indexOf(stepId) < startIndex)
  } else {
    steps.value = []
    logs.value = []
  }
  errorMessage.value = ''
  result.value = null
  cancellationRequested.value = false
  try {
    result.value = await invoke<DesktopResult>('run_project_workflow', {
      request,
      projectRoot: resolvedProjectDir,
    })
  } catch (error) {
    if (cancellationRequested.value) {
      steps.value = steps.value.map((step) => {
        return step.status === 'running'
          ? {...step, status: 'cancelled', detail: '사용자가 작업을 취소했습니다.'}
          : step
      })
    } else {
      errorMessage.value = String(error)
    }
  } finally {
    running.value = false
    activeExecutionId.value = null
  }
}

async function cancelWorkflow() {
  if (!activeExecutionId.value) {
    return
  }
  cancellationRequested.value = true
  await invoke('cancel_operation', {executionId: activeExecutionId.value})
}

async function confirmClose() {
  await cancelWorkflow()
  await getCurrentWindow().destroy()
}

async function openAuthenticationUrl() {
  if (authenticationPrompt.value?.url) {
    await openUrl(authenticationPrompt.value.url)
  }
}

async function openResultUrl(kind: 'github' | 'vercel') {
  errorMessage.value = ''
  try {
    if (kind === 'github' && result.value?.githubRepository) {
      await openUrl(`https://github.com/${result.value.githubRepository}`)
    }
    if (kind === 'vercel' && result.value?.deploymentUrl) {
      await openUrl(normalizeDeploymentUrl(result.value.deploymentUrl))
    }
  } catch (error) {
    errorMessage.value = `페이지를 열지 못했습니다: ${String(error)}`
  }
}

onMounted(async () => {
  unlisteners.push(
    await listen<WorkflowEvent>('workflow-event', ({payload}) => {
      steps.value = applyWorkflowEvent(steps.value, payload)
    }),
    await listen<LifecycleEvent>('operation-start', ({payload}) => {
      activeExecutionId.value = payload.executionId
    }),
    await listen<OutputEvent>('operation-output', ({payload}) => {
      appendLog(payload.text)
    }),
    await getCurrentWindow().onCloseRequested(async (event) => {
      if (!running.value) {
        return
      }
      event.preventDefault()
      closeConfirmationVisible.value = true
    }),
  )
  await inspectTools()
})

onUnmounted(() => {
  for (const unlisten of unlisteners) {
    unlisten()
  }
})
</script>

<template>
  <main class="app-shell">
    <header class="hero">
      <div>
        <p class="eyebrow">CREATE VIBE START</p>
        <h1>아이디어를 프로젝트로<br />바로 시작하세요.</h1>
        <p class="hero-copy">필요한 도구 확인부터 GitHub와 Vercel 배포까지 한 화면에서 진행합니다.</p>
      </div>
    </header>

    <p v-if="errorMessage" class="alert" role="alert">{{ errorMessage }}</p>

    <section class="panel" aria-labelledby="tools-title">
      <div class="section-heading">
        <div>
          <span class="step-number">01</span>
          <h2 id="tools-title">개발 도구 준비</h2>
        </div>
        <button class="text-button" :disabled="loadingTools || running" @click="inspectTools">다시 확인</button>
      </div>
      <p v-if="loadingTools" class="muted">설치와 로그인 상태를 확인하고 있습니다…</p>
      <div v-else class="tool-grid">
        <article v-for="tool in tools" :key="tool.tool" class="tool-card">
          <div>
            <strong>{{ toolLabels[tool.tool] }}</strong>
            <p>{{ tool.message }}</p>
          </div>
          <span v-if="tool.installed && tool.authenticated !== false" class="status ready">준비됨</span>
          <button
            v-else-if="!tool.installed"
            class="small-button"
            :disabled="busyTool !== null || running"
            @click="runToolAction(tool.tool, 'install')"
          >
            {{ busyTool === tool.tool ? '진행 중…' : '설치' }}
          </button>
          <button
            v-else
            class="small-button"
            :disabled="busyTool !== null || running"
            @click="runToolAction(tool.tool, 'login')"
          >
            {{ busyTool === tool.tool ? '진행 중…' : '로그인' }}
          </button>
        </article>
      </div>
      <aside v-if="authenticationPrompt" class="auth-prompt" aria-live="polite">
        <div>
          <strong>브라우저 인증을 계속해주세요.</strong>
          <p v-if="authenticationPrompt.code">
            인증 코드: <code>{{ authenticationPrompt.code }}</code>
          </p>
        </div>
        <button v-if="authenticationPrompt.url" class="secondary-button" @click="openAuthenticationUrl">
          인증 페이지 열기
        </button>
      </aside>
    </section>

    <section class="panel" aria-labelledby="project-title">
      <div class="section-heading">
        <div>
          <span class="step-number">02</span>
          <h2 id="project-title">프로젝트 설정</h2>
        </div>
      </div>

      <div class="form-grid">
        <div class="form-field">
          <Label for="project-name" class="form-label">프로젝트 이름</Label>
          <input
            id="project-name"
            v-model="projectName"
            :disabled="running"
            :aria-invalid="projectNameError ? 'true' : undefined"
            :aria-describedby="projectNameError ? 'project-name-error' : undefined"
            maxlength="100"
            autocomplete="off"
            autocapitalize="none"
            :spellcheck="false"
          />
          <small v-if="projectNameError" id="project-name-error" class="form-error" role="alert">
            {{ projectNameError }}
          </small>
        </div>
        <div class="form-field folder-field">
          <Label for="parent-directory" class="form-label">저장할 상위 폴더</Label>
          <div>
            <input
              id="parent-directory"
              v-model="parentDir"
              :disabled="running"
              readonly
              placeholder="폴더를 선택하세요"
            />
            <button type="button" class="secondary-button" :disabled="running" @click="chooseParentDirectory">
              선택
            </button>
          </div>
        </div>
      </div>

      <div class="options-grid">
        <div class="option-card" :data-disabled="running || undefined">
          <CheckboxRoot id="github-option" v-model="createGithubRepository" class="option-checkbox" :disabled="running">
            <CheckboxIndicator class="option-checkbox-indicator" />
          </CheckboxRoot>
          <Label for="github-option" class="option-label">
            <strong>GitHub 저장소</strong><small>비공개 저장소 생성 및 첫 푸시</small>
          </Label>
        </div>
        <div class="option-card" :data-disabled="running || !createGithubRepository || undefined">
          <CheckboxRoot
            id="vercel-option"
            v-model="deployVercel"
            class="option-checkbox"
            :disabled="running || !createGithubRepository"
          >
            <CheckboxIndicator class="option-checkbox-indicator" />
          </CheckboxRoot>
          <Label for="vercel-option" class="option-label">
            <strong>Vercel 배포</strong><small>프로덕션 환경과 데이터베이스 연결</small>
          </Label>
        </div>
        <div class="option-card" :data-disabled="running || undefined">
          <CheckboxRoot id="codex-option" v-model="openCodex" class="option-checkbox" :disabled="running">
            <CheckboxIndicator class="option-checkbox-indicator" />
          </CheckboxRoot>
          <Label for="codex-option" class="option-label">
            <strong>Codex에서 열기</strong><small>완료된 프로젝트를 Codex 앱으로 실행</small>
          </Label>
        </div>
        <div class="option-card" :data-disabled="running || undefined">
          <CheckboxRoot id="dev-server-option" v-model="startDevServer" class="option-checkbox" :disabled="running">
            <CheckboxIndicator class="option-checkbox-indicator" />
          </CheckboxRoot>
          <Label for="dev-server-option" class="option-label">
            <strong>로컬 미리보기</strong><small>백그라운드에서 pnpm run dev 실행</small>
          </Label>
        </div>
      </div>

      <div v-if="createGithubRepository" class="identity-grid">
        <div class="form-field">
          <Label for="git-author-name" class="form-label">Git 작성자 이름</Label>
          <input
            id="git-author-name"
            v-model="gitAuthorName"
            :disabled="running"
            autocomplete="name"
            placeholder="Your Name"
          />
        </div>
        <div class="form-field">
          <Label for="git-author-email" class="form-label">Git 작성자 이메일</Label>
          <input
            id="git-author-email"
            v-model="gitAuthorEmail"
            :disabled="running"
            autocomplete="email"
            placeholder="you@example.com"
          />
        </div>
      </div>

      <div class="primary-actions">
        <button class="primary-button" :disabled="!canSubmit" @click="createProject()">
          {{ running ? '프로젝트 만드는 중…' : successful ? '다시 만들기' : '프로젝트 만들기' }}
        </button>
        <button
          v-if="failedStep && !running"
          class="secondary-button"
          :disabled="!canSubmit"
          @click="createProject(failedStep.stepId)"
        >
          실패 단계부터 재시도
        </button>
        <button v-if="running" class="danger-button" @click="cancelWorkflow">작업 취소</button>
      </div>
      <p v-if="!requiredToolsReady" class="form-hint">선택한 기능에 필요한 도구를 먼저 준비해주세요.</p>
    </section>

    <section v-if="steps.length || logs.length" class="panel" aria-labelledby="progress-title">
      <div class="section-heading">
        <div>
          <span class="step-number">03</span>
          <h2 id="progress-title">진행 상태</h2>
        </div>
      </div>
      <ol class="timeline">
        <li v-for="step in steps" :key="step.stepId" :class="step.status">
          <span class="timeline-dot" aria-hidden="true"></span>
          <div>
            <strong>{{ step.message }}</strong>
            <p v-if="step.detail">{{ step.detail }}</p>
          </div>
          <span class="timeline-status">{{ step.status }}</span>
        </li>
      </ol>
      <CollapsibleRoot v-if="logs.length" v-model:open="logsExpanded" class="logs">
        <CollapsibleTrigger class="logs-trigger">
          <span>상세 로그 보기</span>
          <span aria-hidden="true">{{ logsExpanded ? '−' : '+' }}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ScrollAreaRoot class="logs-scroll" type="auto">
            <ScrollAreaViewport class="logs-viewport">
              <pre>{{ logs.join('\n') }}</pre>
            </ScrollAreaViewport>
            <ScrollAreaScrollbar class="logs-scrollbar" orientation="vertical">
              <ScrollAreaThumb class="logs-thumb" />
            </ScrollAreaScrollbar>
          </ScrollAreaRoot>
        </CollapsibleContent>
      </CollapsibleRoot>
    </section>

    <section v-if="successful && result" class="success-panel">
      <p class="eyebrow">READY</p>
      <h2>프로젝트 준비가 끝났습니다.</h2>
      <div class="result-actions">
        <button v-if="result.githubRepository" class="secondary-button" @click="openResultUrl('github')">
          GitHub 열기
        </button>
        <button v-if="result.deploymentUrl" class="secondary-button" @click="openResultUrl('vercel')">
          배포 사이트 열기
        </button>
      </div>
    </section>

    <AlertDialogRoot v-model:open="closeConfirmationVisible">
      <AlertDialogPortal>
        <AlertDialogOverlay class="modal-backdrop" />
        <AlertDialogContent class="modal">
          <AlertDialogTitle class="modal-title">진행 중인 작업을 취소할까요?</AlertDialogTitle>
          <AlertDialogDescription class="modal-description">
            앱을 닫으면 현재 실행 중인 프로세스가 종료됩니다.
          </AlertDialogDescription>
          <div class="primary-actions">
            <AlertDialogAction as-child>
              <button class="danger-button" @click="confirmClose">작업 취소 후 닫기</button>
            </AlertDialogAction>
            <AlertDialogCancel as-child>
              <button class="secondary-button">계속 진행</button>
            </AlertDialogCancel>
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialogRoot>
  </main>
</template>
