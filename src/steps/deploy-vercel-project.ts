import {mkdir, readFile, writeFile} from 'node:fs/promises'
import {homedir} from 'node:os'
import {join} from 'node:path'
import {log} from '@clack/prompts'
import chalk from 'chalk'
import {runCommand} from '../utils/run-command'

type VercelProject = {
  id: string
  accountId: string
}

/**
 * 생성된 메인 앱을 GitHub 연동 Vercel 프로젝트로 만들고 프로덕션으로 배포합니다.
 *
 * @param projectDir - 생성된 프로젝트 루트 폴더입니다.
 * @param projectName - 연결할 Vercel 프로젝트 이름입니다.
 * @param githubRepository - GitHub 저장소의 owner/name 형식 이름입니다.
 */
export async function deployVercelProject(projectDir: string, projectName: string, githubRepository: string) {
  log.step(chalk.bold('Vercel 배포'))

  const project = await createVercelProject(projectName, githubRepository)
  await writeVercelProjectLink(projectDir, project)
  await runCommand('vercel', ['--prod'], 'vercel --prod', projectDir)

  log.message(chalk.green(`Vercel 배포 완료: ${projectName}`))
}

/** Vercel API 토큰을 환경 변수 또는 Vercel CLI 인증 파일에서 읽습니다. */
async function vercelToken() {
  if (process.env.VERCEL_TOKEN) {
    return process.env.VERCEL_TOKEN
  }

  const authPath = join(vercelConfigDirectory(), 'auth.json')
  const auth = JSON.parse(await readFile(authPath, 'utf8')) as {token?: string}
  if (!auth.token) {
    throw new Error('Vercel API 토큰을 찾을 수 없습니다. Vercel CLI에 다시 로그인해주세요.')
  }

  return auth.token
}

/** GitHub 저장소와 앱 루트가 설정된 Vercel 프로젝트를 생성합니다. */
async function createVercelProject(projectName: string, githubRepository: string): Promise<VercelProject> {
  const response = await fetch('https://api.vercel.com/v11/projects', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await vercelToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      framework: 'nitro',
      gitRepository: {
        repo: githubRepository,
        type: 'github',
      },
      name: projectName,
      rootDirectory: 'apps/main-app',
    }),
  })

  const body = await response.json().catch(() => undefined) as {
    accountId?: string
    error?: {message?: string}
    id?: string
  }
  if (!response.ok || !body?.id || !body.accountId) {
    throw new Error(body?.error?.message ?? 'Vercel 프로젝트 생성에 실패했습니다.')
  }

  return {id: body.id, accountId: body.accountId}
}

/** Vercel CLI가 생성된 프로젝트를 현재 앱 폴더에서 사용할 수 있도록 링크 파일을 씁니다. */
async function writeVercelProjectLink(appDir: string, project: VercelProject) {
  const vercelDir = join(appDir, '.vercel')
  await mkdir(vercelDir, {recursive: true})
  await writeFile(
    join(vercelDir, 'project.json'),
    `${JSON.stringify({orgId: project.accountId, projectId: project.id}, null, 2)}\n`,
  )
}

/** 현재 플랫폼의 Vercel CLI 설정 폴더 경로를 반환합니다. */
function vercelConfigDirectory(): string {
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'com.vercel.cli')
  }

  if (process.platform === 'win32' && process.env.APPDATA) {
    return join(process.env.APPDATA, 'com.vercel.cli')
  }

  return join(process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'), 'com.vercel.cli')
}
