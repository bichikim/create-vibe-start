import {randomBytes} from 'node:crypto'
import {access, mkdir, readFile, rm, writeFile} from 'node:fs/promises'
import {homedir} from 'node:os'
import {join} from 'node:path'
import {log} from '@clack/prompts'
import chalk from 'chalk'
import {execa} from 'execa'
import {runCommand} from '../utils/run-command'

type VercelProject = {
  id: string
  accountId: string
}

type ResolvedVercelProject = {
  project: VercelProject
  reusedLink: boolean
}

type RepairEnv = {
  BETTER_AUTH_SECRET?: string
  TURSO_AUTH_TOKEN?: string
  TURSO_DATABASE_URL?: string
}

type DeployVercelProjectOptions = {
  githubRepository?: string
}

/**
 * 생성된 메인 앱을 GitHub 연동 Vercel 프로젝트로 만들고 프로덕션으로 배포합니다.
 *
 * @param projectDir - 생성된 프로젝트 루트 폴더입니다.
 * @param projectName - 연결할 Vercel 프로젝트 이름입니다.
 * @param options - 기존 Vercel 링크가 없을 때 사용할 GitHub 저장소 정보입니다.
 */
export async function deployVercelProject(
  projectDir: string,
  projectName: string,
  options: DeployVercelProjectOptions = {},
) {
  await assertGeneratedProjectRoot(projectDir)

  log.step(chalk.bold('Vercel 배포'))

  const {project, reusedLink} = await resolveVercelProject(projectDir, projectName, options.githubRepository)
  let productionEnv: RepairEnv = reusedLink ? await pullVercelProductionEnv(projectDir) : {}

  if (!productionEnv.TURSO_DATABASE_URL) {
    await connectTursoDatabase(projectDir, projectName)
    productionEnv = await pullVercelProductionEnv(projectDir)
  } else {
    log.message(chalk.dim('기존 Turso production 환경 변수를 재사용합니다.'))
  }

  if (productionEnv.BETTER_AUTH_SECRET) {
    log.message(chalk.dim('기존 Better Auth production secret을 재사용합니다.'))
  } else {
    await setBetterAuthSecret(project)
  }

  if (
    reusedLink &&
    productionEnv.TURSO_DATABASE_URL &&
    productionEnv.BETTER_AUTH_SECRET &&
    await hasReadyProductionDeployment(project)
  ) {
    await ensureMobileApiUrl(projectDir, projectName)
    log.message(chalk.green(`Vercel repair 완료: ${projectName}은 이미 설정되어 있습니다.`))
    return
  }

  await migrateTursoDatabase(projectDir, productionEnv)
  await runCommand('vercel', ['--prod'], 'vercel --prod', projectDir)
  await ensureMobileApiUrl(projectDir, projectName)

  log.message(chalk.green(`Vercel 배포 완료: ${projectName}`))
  log.message(chalk.dim('Better Auth URL은 Vercel 시스템 변수(VERCEL_URL)로 런타임에 결정됩니다.'))
}

async function assertGeneratedProjectRoot(projectDir: string) {
  try {
    await access(join(projectDir, 'apps/main-app/package.json'))
  } catch {
    throw new Error('생성된 프로젝트 루트가 아닙니다. --dir에는 create-vibe-start 프로젝트 루트를 지정해주세요.')
  }
}

async function resolveVercelProject(
  projectDir: string,
  projectName: string,
  githubRepository: string | undefined,
): Promise<ResolvedVercelProject> {
  const linkedProject = await readVercelProjectLink(projectDir)
  if (linkedProject) {
    if (githubRepository) {
      log.warn('기존 Vercel 프로젝트 링크를 재사용하므로 --github-repository 옵션은 무시합니다.')
    }

    log.message(chalk.dim('기존 Vercel 프로젝트 링크를 재사용합니다.'))
    return {project: linkedProject, reusedLink: true}
  }

  if (!githubRepository) {
    throw new Error('기존 Vercel 링크가 없으면 --github-repository owner/name 이 필요합니다.')
  }

  const project = await createVercelProject(projectName, githubRepository)
  await writeVercelProjectLink(projectDir, project)
  return {project, reusedLink: false}
}

async function readVercelProjectLink(projectDir: string): Promise<VercelProject | null> {
  try {
    const projectJson = JSON.parse(await readFile(vercelProjectLinkPath(projectDir), 'utf8')) as {
      orgId?: string
      projectId?: string
    }

    if (!projectJson.orgId || !projectJson.projectId) {
      throw new Error('Vercel 프로젝트 링크 파일이 올바르지 않습니다.')
    }

    return {accountId: projectJson.orgId, id: projectJson.projectId}
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }

    throw error
  }
}

const AUTH_SECRET_BYTES = 32

function generateAuthSecret() {
  return randomBytes(AUTH_SECRET_BYTES).toString('base64')
}

/** BETTER_AUTH_URL은 앱이 VERCEL_*로 런타임 결정하므로 production secret만 설정합니다. */
async function setBetterAuthSecret(project: VercelProject) {
  const response = await fetch(
    `https://api.vercel.com/v10/projects/${project.id}/env?teamId=${project.accountId}&upsert=true`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await vercelToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {key: 'BETTER_AUTH_SECRET', value: generateAuthSecret(), type: 'sensitive', target: ['production']},
      ]),
    },
  )

  const body = await response.json().catch(() => undefined) as {error?: {message?: string}}
  if (!response.ok) {
    throw new Error(body?.error?.message ?? 'Better Auth 환경 변수 설정에 실패했습니다.')
  }
}

/** Turso에 Drizzle 마이그레이션을 적용해 Better Auth 테이블을 만듭니다. */
async function migrateTursoDatabase(projectDir: string, turso: RepairEnv) {
  const appDir = join(projectDir, 'apps/main-app')
  if (!turso.TURSO_DATABASE_URL) {
    throw new Error('TURSO_DATABASE_URL을 찾을 수 없습니다. Turso 연동 후 다시 시도해주세요.')
  }

  log.info('실행: pnpm db:migrate (Turso production)')
  await execa('pnpm', ['db:migrate'], {
    cwd: appDir,
    stdio: 'inherit',
    env: {...process.env, ...turso},
  })
}

function migrationEnvFile(projectDir: string) {
  return join(projectDir, 'apps/main-app', '.env.migrate.local')
}

function mobileEnvFile(projectDir: string) {
  return join(projectDir, 'apps/main-app', '.env.mobile')
}

async function ensureMobileApiUrl(projectDir: string, projectName: string) {
  const envFile = mobileEnvFile(projectDir)
  const apiUrl = `https://${projectName}.vercel.app`
  let content = ''

  try {
    content = await readFile(envFile, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }

  if (/^\s*VITE_API_URL\s*=/mu.test(content)) {
    log.message(chalk.dim('기존 모바일 API URL을 유지합니다.'))
    return
  }

  const prefix = content && !content.endsWith('\n') ? '\n' : ''
  const nextContent = `${content}${prefix}VITE_API_URL=${apiUrl}\n`
  await writeFile(envFile, nextContent)
  log.message(chalk.dim(`모바일 API URL을 apps/main-app/.env.mobile에 설정했습니다: ${apiUrl}`))
}

async function pullVercelProductionEnv(projectDir: string) {
  const envFile = migrationEnvFile(projectDir)
  try {
    await runCommand(
      'vercel',
      ['env', 'pull', envFile, '--environment', 'production', '--yes'],
      'vercel env pull',
      projectDir,
    )

    return await readRepairEnvFromFile(envFile)
  } finally {
    await rm(envFile, {force: true})
  }
}

async function readRepairEnvFromFile(envFile: string): Promise<RepairEnv> {
  const content = await readFile(envFile, 'utf8')
  const values: RepairEnv = {}

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const separator = trimmed.indexOf('=')
    if (separator === -1) {
      continue
    }

    const key = trimmed.slice(0, separator).trim()
    if (key !== 'TURSO_DATABASE_URL' && key !== 'TURSO_AUTH_TOKEN' && key !== 'BETTER_AUTH_SECRET') {
      continue
    }

    let value = trimmed.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    values[key] = value
  }

  return values
}

async function hasReadyProductionDeployment(project: VercelProject) {
  const url = new URL('https://api.vercel.com/v13/deployments')
  url.searchParams.set('projectId', project.id)
  url.searchParams.set('target', 'production')
  url.searchParams.set('limit', '20')
  url.searchParams.set('teamId', project.accountId)

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${await vercelToken()}`,
    },
  })

  const body = await response.json().catch(() => undefined) as {
    deployments?: Array<{state?: string; target?: string}>
    error?: {message?: string}
  }
  if (!response.ok) {
    throw new Error(body?.error?.message ?? 'Vercel deployment 상태 확인에 실패했습니다.')
  }

  return Boolean(body.deployments?.some((deployment) => (
    deployment.state === 'READY' && deployment.target === 'production'
  )))
}

/** Vercel Marketplace Turso 리소스를 만들고 현재 프로젝트의 production 환경에 연결합니다. */
async function connectTursoDatabase(projectDir: string, projectName: string) {
  await runCommand(
    'vercel',
    [
      'integration',
      'add',
      'tursocloud/database',
      '--name',
      projectName,
      '--metadata',
      'region=iad1',
      '--plan',
      'starter',
      '--environment',
      'production',
      '--no-env-pull',
    ],
    'vercel integration add tursocloud/database',
    projectDir,
  )
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
      framework: 'vite',
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
    vercelProjectLinkPath(appDir),
    `${JSON.stringify({orgId: project.accountId, projectId: project.id}, null, 2)}\n`,
  )
}

function vercelProjectLinkPath(projectDir: string) {
  return join(projectDir, '.vercel', 'project.json')
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
