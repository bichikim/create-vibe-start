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

export async function verifyCodemagicApplication(applicationId: string, token: string): Promise<void> {
  await codemagicRequest(`/apps/${encodeURIComponent(applicationId)}`, token)
}

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
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-auth-token': token,
      ...init.headers,
    },
  })
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
