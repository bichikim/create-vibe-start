import {isRecord} from '../utils/is-record'

interface CodemagicApplication {
  readonly id: string
}

interface StartBuildOptions {
  readonly applicationId: string
  readonly branch: string
  readonly token: string
  readonly workflowId: 'android-release' | 'ios-release'
}

const API_URL = 'https://api.codemagic.io'

/** 저장된 Application ID가 현재 token으로 접근 가능한지 확인한다. */
export async function verifyCodemagicApplication(applicationId: string, token: string): Promise<void> {
  await codemagicRequest(`/apps/${encodeURIComponent(applicationId)}`, token)
}

/** Git remote URL을 Codemagic에 등록하고 이후 요청에 사용할 Application ID만 반환한다. */
export async function registerCodemagicApplication(
  repositoryUrl: string,
  token: string,
): Promise<CodemagicApplication> {
  const value = await codemagicRequest('/apps', token, {
    method: 'POST',
    body: JSON.stringify({repositoryUrl}),
  })
  const application = applicationFromResponse(value)
  if (application === undefined) {
    throw new Error('Codemagic Application ID를 응답에서 찾을 수 없습니다.')
  }
  return application
}

/** 선택한 branch와 workflow로 빌드를 시작하고 대시보드 링크에 사용할 Build ID를 반환한다. */
export async function startCodemagicBuild(options: StartBuildOptions): Promise<string> {
  const value = await codemagicRequest('/builds', options.token, {
    method: 'POST',
    body: JSON.stringify({
      appId: options.applicationId,
      workflowId: options.workflowId,
      branch: options.branch,
    }),
  })
  if (!isRecord(value) || typeof value.buildId !== 'string' || !value.buildId) {
    throw new Error('Codemagic Build ID를 응답에서 찾을 수 없습니다.')
  }
  return value.buildId
}

async function codemagicRequest(path: string, token: string, init: RequestInit = {}): Promise<unknown> {
  // token은 요청 헤더에만 사용하며 프로젝트 설정이나 오류 메시지에는 포함하지 않는다.
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-auth-token': token,
      ...init.headers,
    },
  })
  // 오류 응답이 JSON이 아니어도 상태 코드를 사용한 안전한 메시지로 변환한다.
  const value: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const message =
      isRecord(value) && typeof value.message === 'string'
        ? value.message
        : `Codemagic API 요청 실패 (${response.status})`
    throw new Error(message)
  }
  return value
}

function applicationFromResponse(value: unknown): CodemagicApplication | undefined {
  if (isRecord(value) && typeof value._id === 'string' && value._id) {
    return {id: value._id}
  }
  if (isRecord(value) && isRecord(value.application) && typeof value.application._id === 'string') {
    return {id: value.application._id}
  }
  return undefined
}
