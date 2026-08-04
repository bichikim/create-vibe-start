import {readFile} from 'node:fs/promises'
import {join, resolve} from 'node:path'
import {isCancel, log, outro, select} from '@clack/prompts'
import chalk from 'chalk'
import {parseOrThrow} from '../core/schemas/parse'
import {type SetupProjectOptions, setupProjectOptionsSchema} from '../core/schemas/setup-project-options'
import {connectGitHubProject, readGitHubRepository} from '../steps/connect-github-project'
import {deployVercelProject} from '../steps/deploy-vercel-project'
import {setupGitHub} from '../steps/setup-github'
import {runCodemagicBuild, setupMobileDeployment} from '../steps/setup-mobile-deployment'
import {readProjectSetupConfig} from '../steps/project-setup-config'
import {setupVercel} from '../steps/setup-vercel'

interface ProjectDetails {
  readonly dir: string
  readonly name: string
}

type SetupAction = 'all' | 'github' | 'vercel' | 'mobile' | 'codemagic' | 'status'

/** Runs the post-creation setup wizard from inside a generated project. */
export async function runSetupProject(options: unknown) {
  try {
    const parsed = parseOrThrow(setupProjectOptionsSchema, options)
    const project = await readProjectDetails(parsed)
    if (parsed.check) {
      // CI에서는 계정 로그인이나 대화형 입력 없이 로컬 setup runtime의 로딩만 확인한다.
      outro(chalk.green(`프로젝트 setup runtime 확인 완료: ${project.name}`))
      return
    }
    const action = await selectSetupAction()
    if (action === undefined) {
      outro(chalk.yellow('프로젝트 설정을 취소했습니다.'))
      return
    }

    // 전체 설정은 Vercel과 Codemagic이 앞 단계의 저장소와 App ID를 재사용할 수 있도록 순서대로 실행한다.
    if (action === 'all' || action === 'github') {
      await setupGitHubConnection(project)
    }
    if (action === 'all' || action === 'vercel') {
      await setupVercelDeployment(project)
    }
    if (action === 'all' || action === 'mobile') {
      await setupMobileDeployment(project.dir)
    }
    if (action === 'codemagic') {
      await runCodemagicBuild(project.dir)
    }
    if (action === 'status') {
      await showSetupStatus(project)
    }

    outro(chalk.green('프로젝트 설정을 완료했습니다.'))
  } catch (error) {
    outro(chalk.red(error instanceof Error ? error.message : String(error)))
    process.exitCode = 1
  }
}

async function selectSetupAction(): Promise<SetupAction | undefined> {
  const action = await select({
    message: '설정할 항목을 선택해주세요.',
    options: [
      {label: '전체 설정', value: 'all'},
      {label: 'GitHub 연결', value: 'github'},
      {label: 'Vercel 연결 및 배포', value: 'vercel'},
      {label: '모바일 배포 준비', value: 'mobile'},
      {label: 'Codemagic 빌드 실행', value: 'codemagic'},
      {label: '현재 설정 점검', value: 'status'},
    ],
  })
  return isCancel(action) ? undefined : action
}

async function readProjectDetails(options: SetupProjectOptions): Promise<ProjectDetails> {
  const dir = resolve(options.dir)
  let packageJson: unknown
  try {
    // 루트와 main-app의 package.json을 함께 확인해 임의의 폴더에서 배포 명령이 실행되지 않게 한다.
    packageJson = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
    await readFile(join(dir, 'apps/main-app/package.json'), 'utf8')
  } catch (error) {
    throw new Error('생성된 프로젝트 루트가 아닙니다. --dir 경로를 확인해주세요.', {cause: error})
  }

  if (!isNamedPackage(packageJson)) {
    throw new Error('프로젝트 package.json의 name을 확인해주세요.')
  }

  return {dir, name: packageJson.name}
}

function isNamedPackage(value: unknown): value is {readonly name: string} {
  return typeof value === 'object' && value !== null && 'name' in value && typeof value.name === 'string'
}

async function setupGitHubConnection(project: ProjectDetails) {
  const setupResult = await setupGitHub()
  if (setupResult.status !== 'ready') {
    throw new Error(setupResult.message)
  }

  const repository = await connectGitHubProject(project.dir, project.name)
  log.success(`GitHub 연결 완료: ${repository}`)
  return repository
}

async function setupVercelDeployment(project: ProjectDetails) {
  const setupResult = await setupVercel()
  if (setupResult.status !== 'ready') {
    throw new Error(setupResult.message)
  }

  // Vercel Git 연결에 owner/name이 필요하므로 저장소가 없으면 GitHub 설정부터 이어서 진행한다.
  const repository = (await readGitHubRepository(project.dir)) ?? (await setupGitHubConnection(project))
  const deploymentUrl = await deployVercelProject(project.dir, project.name, {githubRepository: repository})
  log.success(`Vercel 배포 완료: ${deploymentUrl}`)
}

async function showSetupStatus(project: ProjectDetails) {
  const repository = await readGitHubRepository(project.dir)
  log.info(`GitHub: ${repository ?? '연결되지 않음'}`)
  try {
    await readFile(join(project.dir, '.vercel/project.json'), 'utf8')
    log.info('Vercel: 연결됨')
  } catch {
    log.info('Vercel: 연결되지 않음')
  }

  const config = await readProjectSetupConfig(project.dir)
  log.info(`iOS: ${config.mobile?.iosBundleId ?? '설정되지 않음'}`)
  log.info(`Android: ${config.mobile?.androidPackageName ?? '설정되지 않음'}`)
  log.info(`Codemagic: ${config.codemagic?.applicationId ?? '연결되지 않음'}`)
}
