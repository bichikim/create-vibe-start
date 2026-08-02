import {access, mkdir, readFile, rm, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {log} from '@clack/prompts'
import chalk from 'chalk'
import {execa} from 'execa'
import {assertValidProjectName} from '../core/project-name'
import {withNetworkRetry} from '../utils/network-retry'
import {runCommand} from '../utils/run-command'
import {isRecord} from '../utils/is-record'
import {createVercelProject, findProductionDeployment, setBetterAuthSecret, type VercelProject} from './vercel-api'

interface ResolvedVercelProject {
  readonly project: VercelProject
  readonly source: 'created' | 'linked'
}

interface RepairEnv {
  BETTER_AUTH_SECRET?: string
  TURSO_AUTH_TOKEN?: string
  TURSO_DATABASE_URL?: string
}

interface DeployVercelProjectOptions {
  readonly githubRepository?: string
}

/**
 * 생성된 메인 앱을 GitHub 연동 Vercel 프로젝트로 만들고 프로덕션으로 배포합니다.
 *
 * @param projectDir - 생성된 프로젝트 루트 폴더입니다.
 * @param projectName - 연결할 Vercel 프로젝트 이름입니다.
 * @param options - 기존 Vercel 링크가 없을 때 사용할 GitHub 저장소 정보입니다.
 * @returns 브라우저에서 열 수 있는 정규화된 production 배포 URL입니다.
 */
export async function deployVercelProject(
  projectDir: string,
  projectName: string,
  options: DeployVercelProjectOptions = {},
): Promise<string> {
  assertValidProjectName(projectName)
  await assertGeneratedProjectRoot(projectDir)

  log.step(chalk.bold('Vercel 배포'))

  const {project, source} = await resolveVercelProject(projectDir, projectName, options.githubRepository)
  const reusedLink = source === 'linked'
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

  const existingDeployment =
    reusedLink && productionEnv.TURSO_DATABASE_URL && productionEnv.BETTER_AUTH_SECRET
      ? await findProductionDeployment(project)
      : {ready: false, url: null}

  if (existingDeployment.ready) {
    await ensureMobileApiUrl(projectDir, projectName)
    log.message(chalk.green(`Vercel repair 완료: ${projectName}은 이미 설정되어 있습니다.`))
    return existingDeployment.url ?? defaultDeploymentUrl(projectName)
  }

  await migrateTursoDatabase(projectDir, productionEnv)
  await runCommand('vercel', ['--prod'], 'vercel --prod', projectDir)
  await ensureMobileApiUrl(projectDir, projectName)

  log.message(chalk.green(`Vercel 배포 완료: ${projectName}`))
  log.message(chalk.dim('Better Auth URL은 Vercel 시스템 변수(VERCEL_URL)로 런타임에 결정됩니다.'))
  try {
    return (await findProductionDeployment(project)).url ?? defaultDeploymentUrl(projectName)
  } catch (error) {
    log.warn(`실제 배포 URL을 확인하지 못해 기본 URL을 사용합니다: ${String(error)}`)
    return defaultDeploymentUrl(projectName)
  }
}

function defaultDeploymentUrl(projectName: string) {
  return new URL(`https://${projectName}.vercel.app`).toString()
}

async function assertGeneratedProjectRoot(projectDir: string) {
  try {
    await access(join(projectDir, 'apps/main-app/package.json'))
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT') || hasErrorCode(error, 'ENOTDIR')) {
      throw new Error('생성된 프로젝트 루트가 아닙니다. --dir에는 create-vibe-start 프로젝트 루트를 지정해주세요.', {
        cause: error,
      })
    }

    throw error
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
    return {project: linkedProject, source: 'linked'}
  }

  if (!githubRepository) {
    throw new Error('기존 Vercel 링크가 없으면 --github-repository owner/name 이 필요합니다.')
  }

  const project = await createVercelProject(projectName, githubRepository)
  await writeVercelProjectLink(projectDir, project)
  return {project, source: 'created'}
}

interface VercelProjectLink {
  readonly orgId: string
  readonly projectId: string
}

function isVercelProjectLink(value: unknown): value is VercelProjectLink {
  return (
    isRecord(value) &&
    typeof value.orgId === 'string' &&
    value.orgId.length > 0 &&
    typeof value.projectId === 'string' &&
    value.projectId.length > 0
  )
}

function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}

async function readVercelProjectLink(projectDir: string): Promise<VercelProject | null> {
  try {
    const content = await readFile(vercelProjectLinkPath(projectDir), 'utf8')
    let projectJson: unknown
    try {
      projectJson = JSON.parse(content)
    } catch (error) {
      throw new Error('Vercel 프로젝트 링크 파일이 올바른 JSON이 아닙니다.', {cause: error})
    }

    if (!isVercelProjectLink(projectJson)) {
      throw new Error('Vercel 프로젝트 링크 파일이 올바르지 않습니다.')
    }

    return {accountId: projectJson.orgId, id: projectJson.projectId}
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      return null
    }

    throw error
  }
}

/** Turso에 Drizzle 마이그레이션을 적용해 Better Auth 테이블을 만듭니다. */
async function migrateTursoDatabase(projectDir: string, turso: RepairEnv) {
  const appDir = join(projectDir, 'apps/main-app')
  if (!turso.TURSO_DATABASE_URL) {
    throw new Error('TURSO_DATABASE_URL을 찾을 수 없습니다. Turso 연동 후 다시 시도해주세요.')
  }

  if (!turso.TURSO_DATABASE_URL.startsWith('file:') && !turso.TURSO_AUTH_TOKEN) {
    throw new Error('TURSO_AUTH_TOKEN을 찾을 수 없습니다. Turso 연동 후 다시 시도해주세요.')
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
    if (!hasErrorCode(error, 'ENOENT')) {
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
    await withNetworkRetry('vercel env pull', () =>
      runCommand(
        'vercel',
        ['env', 'pull', envFile, '--environment', 'production', '--yes'],
        'vercel env pull',
        projectDir,
      ),
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
    const entry = repairEnvEntry(line)
    if (entry !== undefined) {
      const [key, value] = entry
      values[key] = value
    }
  }

  return values
}

type RepairEnvEntry = readonly [keyof RepairEnv, string]

function repairEnvEntry(line: string): RepairEnvEntry | undefined {
  const trimmed = line.trim()
  const separator = trimmed.indexOf('=')
  if (!trimmed || trimmed.startsWith('#') || separator === -1) {
    return undefined
  }

  const key = trimmed.slice(0, separator).trim()
  if (key !== 'TURSO_DATABASE_URL' && key !== 'TURSO_AUTH_TOKEN' && key !== 'BETTER_AUTH_SECRET') {
    return undefined
  }

  const rawValue = trimmed.slice(separator + 1).trim()
  const quoted =
    (rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))
  return [key, quoted ? rawValue.slice(1, -1) : rawValue]
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
