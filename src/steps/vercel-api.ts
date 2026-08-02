import {randomBytes} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {isRetryableHttpStatus, withNetworkRetry} from '../utils/network-retry'
import {userDataDirectory} from '../utils/user-directories'

export type VercelProject = {
  id: string
  accountId: string
}

type VercelDeployment = {
  state?: string
  target?: string
  url?: string
}

const AUTH_SECRET_BYTES = 32

/** BETTER_AUTH_URL은 앱이 VERCEL_*로 런타임 결정하므로 production secret만 설정합니다. */
export async function setBetterAuthSecret(project: VercelProject) {
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

  const body = (await response.json().catch(() => undefined)) as {error?: {message?: string}}
  if (!response.ok) {
    throw new Error(body?.error?.message ?? 'Better Auth 환경 변수 설정에 실패했습니다.')
  }
}

export async function findProductionDeployment(project: VercelProject) {
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

  const body = (await response.json().catch(() => undefined)) as {
    deployments?: VercelDeployment[]
    error?: {message?: string}
  }
  if (!response.ok) {
    throw new Error(body?.error?.message ?? 'Vercel deployment 상태 확인에 실패했습니다.')
  }

  const deployment = body.deployments?.find(
    (candidate) => candidate.state === 'READY' && candidate.target === 'production',
  )
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

  const body = (await response.json().catch(() => undefined)) as {
    accountId?: string
    error?: {message?: string}
    id?: string
  }
  if (!response.ok || !body?.id || !body.accountId) {
    throw new Error(body?.error?.message ?? 'Vercel 프로젝트 생성에 실패했습니다.')
  }

  return {id: body.id, accountId: body.accountId}
}

/** Vercel API 토큰을 환경 변수 또는 Vercel CLI 인증 파일에서 읽습니다. */
async function vercelToken() {
  if (process.env.VERCEL_TOKEN) {
    return process.env.VERCEL_TOKEN
  }

  const authPath = join(userDataDirectory(), 'com.vercel.cli', 'auth.json')
  const auth = JSON.parse(await readFile(authPath, 'utf8')) as {token?: string}
  if (!auth.token) {
    throw new Error('Vercel API 토큰을 찾을 수 없습니다. Vercel CLI에 다시 로그인해주세요.')
  }

  return auth.token
}
