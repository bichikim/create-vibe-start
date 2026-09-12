import {randomBytes} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {isRetryableHttpStatus, withNetworkRetry} from '../utils/network-retry'
import {userDataDirectory} from '../utils/user-directories'
import {isRecord} from '../utils/is-record'

export interface VercelProject {
  id: string
  accountId: string
}

interface ProductionDeployment {
  readonly ready: boolean
  readonly url: string | null
}

const AUTH_SECRET_BYTES = 32

function apiErrorMessage(value: unknown): string | undefined {
  if (!isRecord(value) || !isRecord(value.error) || typeof value.error.message !== 'string') {
    return undefined
  }

  return value.error.message
}

function isVercelProject(value: unknown): value is VercelProject {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.accountId === 'string' &&
    value.accountId.length > 0
  )
}

interface VercelDeployment {
  readonly state?: string
  readonly target?: string
  readonly url?: string
}

type ResponseBody = {readonly ok: true; readonly value: unknown} | {readonly ok: false; readonly error: unknown}

function isVercelDeployment(value: unknown): value is VercelDeployment {
  return (
    isRecord(value) &&
    (value.state === undefined || typeof value.state === 'string') &&
    (value.target === undefined || typeof value.target === 'string') &&
    (value.url === undefined || typeof value.url === 'string')
  )
}

function deploymentList(value: unknown): ReadonlyArray<VercelDeployment> | undefined {
  if (!isRecord(value) || !Array.isArray(value.deployments) || !value.deployments.every(isVercelDeployment)) {
    return undefined
  }

  return value.deployments
}

async function responseBody(response: Response): Promise<ResponseBody> {
  try {
    return {ok: true, value: await response.json()}
  } catch (error) {
    return {ok: false, error}
  }
}

function responseError(body: ResponseBody, fallbackMessage: string): Error {
  if (body.ok) {
    return new Error(apiErrorMessage(body.value) ?? fallbackMessage)
  }

  return new Error(fallbackMessage, {cause: body.error})
}

/** BETTER_AUTH_URL은 앱이 VERCEL_*로 런타임 결정하므로 production secret만 설정합니다. */
export async function setBetterAuthSecret(project: VercelProject): Promise<void> {
  const response = await fetch(
    `https://api.vercel.com/v10/projects/${project.id}/env?teamId=${project.accountId}&upsert=true`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await vercelToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          key: 'BETTER_AUTH_SECRET',
          value: randomBytes(AUTH_SECRET_BYTES).toString('base64'),
          type: 'sensitive',
          target: ['production'],
        },
      ]),
    },
  )

  if (!response.ok) {
    const body = await responseBody(response)
    throw responseError(body, 'Better Auth 환경 변수 설정에 실패했습니다.')
  }
}

export async function findProductionDeployment(project: VercelProject): Promise<ProductionDeployment> {
  const url = new URL('https://api.vercel.com/v13/deployments')
  url.searchParams.set('projectId', project.id)
  url.searchParams.set('target', 'production')
  url.searchParams.set('limit', '20')
  url.searchParams.set('teamId', project.accountId)

  const response = await withNetworkRetry(
    'Vercel deployment 상태 확인',
    async () =>
      fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${await vercelToken()}`,
        },
      }),
    {shouldRetryResult: (result) => isRetryableHttpStatus(result.status)},
  )

  const body = await responseBody(response)
  if (!response.ok) {
    throw responseError(body, 'Vercel deployment 상태 확인에 실패했습니다.')
  }

  if (!body.ok) {
    throw new Error('Vercel deployment 응답이 올바른 JSON이 아닙니다.', {cause: body.error})
  }

  const deployments = deploymentList(body.value)
  if (deployments === undefined) {
    throw new Error('Vercel deployment 응답이 올바르지 않습니다.')
  }

  const deployment = deployments.find((candidate) => candidate.state === 'READY' && candidate.target === 'production')
  return {
    ready: Boolean(deployment),
    url: deployment?.url ? new URL(`https://${deployment.url}`).toString() : null,
  }
}

/** GitHub 저장소와 앱 루트가 설정된 Vercel 프로젝트를 생성합니다. */
export async function createVercelProject(projectName: string, githubRepository: string): Promise<VercelProject> {
  const response = await fetch('https://api.vercel.com/v11/projects', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await vercelToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      framework: 'vite',
      gitRepository: {
        repo: githubRepository,
        type: 'github',
      },
      name: projectName,
      rootDirectory: 'apps/main-app',
    }),
  })

  const body = await responseBody(response)
  if (!response.ok) {
    throw responseError(body, 'Vercel 프로젝트 생성에 실패했습니다.')
  }
  if (!body.ok) {
    throw new Error('Vercel 프로젝트 생성 응답이 올바른 JSON이 아닙니다.', {cause: body.error})
  }
  if (!isVercelProject(body.value)) {
    throw new Error(apiErrorMessage(body.value) ?? 'Vercel 프로젝트 생성에 실패했습니다.')
  }

  return {id: body.value.id, accountId: body.value.accountId}
}

/** Vercel API 토큰을 환경 변수 또는 Vercel CLI 인증 파일에서 읽습니다. */
async function vercelToken() {
  if (process.env.VERCEL_TOKEN) {
    return process.env.VERCEL_TOKEN
  }

  const authPath = join(userDataDirectory(), 'com.vercel.cli', 'auth.json')
  let content: string
  try {
    content = await readFile(authPath, 'utf8')
  } catch (error) {
    throw new Error('Vercel API 인증 파일을 읽을 수 없습니다.', {cause: error})
  }

  let auth: unknown
  try {
    auth = JSON.parse(content)
  } catch (error) {
    throw new Error('Vercel API 인증 파일이 올바른 JSON이 아닙니다.', {cause: error})
  }

  if (!isRecord(auth) || typeof auth.token !== 'string' || auth.token.length === 0) {
    throw new Error('Vercel API 토큰을 찾을 수 없습니다. Vercel CLI에 다시 로그인해주세요.')
  }

  return auth.token
}
