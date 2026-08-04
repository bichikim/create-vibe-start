import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const selectMock = vi.fn()
const logInfoMock = vi.fn()
const logSuccessMock = vi.fn()
const outroMock = vi.fn()
const setupGitHubMock = vi.fn()
const setupVercelMock = vi.fn()
const connectGitHubProjectMock = vi.fn()
const readGitHubRepositoryMock = vi.fn()
const deployVercelProjectMock = vi.fn()
const setupMobileDeploymentMock = vi.fn()
const runCodemagicBuildMock = vi.fn()
const readProjectSetupConfigMock = vi.fn()
const cancel = Symbol('cancel')

vi.mock('@clack/prompts', () => ({
  select: selectMock,
  isCancel: (value: unknown) => value === cancel,
  log: {info: logInfoMock, success: logSuccessMock},
  outro: outroMock,
}))

vi.mock('../../steps/setup-github', () => ({setupGitHub: setupGitHubMock}))
vi.mock('../../steps/setup-vercel', () => ({setupVercel: setupVercelMock}))
vi.mock('../../steps/connect-github-project', () => ({
  connectGitHubProject: connectGitHubProjectMock,
  readGitHubRepository: readGitHubRepositoryMock,
}))
vi.mock('../../steps/deploy-vercel-project', () => ({deployVercelProject: deployVercelProjectMock}))
vi.mock('../../steps/setup-mobile-deployment', () => ({
  setupMobileDeployment: setupMobileDeploymentMock,
  runCodemagicBuild: runCodemagicBuildMock,
}))
vi.mock('../../steps/project-setup-config', () => ({
  readProjectSetupConfig: readProjectSetupConfigMock,
}))

describe('runSetupProject', () => {
  let projectDir: string

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), 'setup-project-'))
    await mkdir(join(projectDir, 'apps/main-app'), {recursive: true})
    await writeFile(join(projectDir, 'package.json'), JSON.stringify({name: 'my-app'}))
    await writeFile(join(projectDir, 'apps/main-app/package.json'), JSON.stringify({name: '@my-app/main-app'}))
    selectMock.mockReset()
    logInfoMock.mockReset()
    logSuccessMock.mockReset()
    outroMock.mockReset()
    setupGitHubMock.mockReset().mockResolvedValue({status: 'ready', message: 'ready'})
    setupVercelMock.mockReset().mockResolvedValue({status: 'ready', message: 'ready'})
    connectGitHubProjectMock.mockReset().mockResolvedValue('owner/my-app')
    readGitHubRepositoryMock.mockReset().mockResolvedValue('owner/my-app')
    deployVercelProjectMock.mockReset().mockResolvedValue('https://my-app.vercel.app/')
    setupMobileDeploymentMock.mockReset().mockResolvedValue(undefined)
    runCodemagicBuildMock.mockReset().mockResolvedValue(undefined)
    readProjectSetupConfigMock.mockReset().mockResolvedValue({schemaVersion: 1})
    process.exitCode = undefined
  })

  afterEach(async () => {
    await rm(projectDir, {force: true, recursive: true})
  })

  it('cancels without changing setup', async () => {
    selectMock.mockResolvedValue(cancel)
    const {runSetupProject} = await import('../setup-project')

    await runSetupProject({dir: projectDir})

    expect(outroMock).toHaveBeenCalledWith('프로젝트 설정을 취소했습니다.')
    expect(setupGitHubMock).not.toHaveBeenCalled()
  })

  it('checks the setup runtime without opening prompts', async () => {
    const {runSetupProject} = await import('../setup-project')

    await runSetupProject({dir: projectDir, check: true})

    expect(selectMock).not.toHaveBeenCalled()
    expect(outroMock).toHaveBeenCalledWith('프로젝트 setup runtime 확인 완료: my-app')
  })

  it('connects GitHub', async () => {
    selectMock.mockResolvedValue('github')
    const {runSetupProject} = await import('../setup-project')

    await runSetupProject({dir: projectDir})

    expect(connectGitHubProjectMock).toHaveBeenCalledWith(projectDir, 'my-app')
    expect(logSuccessMock).toHaveBeenCalledWith('GitHub 연결 완료: owner/my-app')
  })

  it('connects and deploys Vercel using the current repository', async () => {
    selectMock.mockResolvedValue('vercel')
    const {runSetupProject} = await import('../setup-project')

    await runSetupProject({dir: projectDir})

    expect(deployVercelProjectMock).toHaveBeenCalledWith(projectDir, 'my-app', {
      githubRepository: 'owner/my-app',
    })
    expect(logSuccessMock).toHaveBeenCalledWith('Vercel 배포 완료: https://my-app.vercel.app/')
  })

  it('connects GitHub before Vercel when no repository exists', async () => {
    selectMock.mockResolvedValue('vercel')
    readGitHubRepositoryMock.mockResolvedValue(undefined)
    const {runSetupProject} = await import('../setup-project')

    await runSetupProject({dir: projectDir})

    expect(connectGitHubProjectMock).toHaveBeenCalledOnce()
    expect(deployVercelProjectMock).toHaveBeenCalledWith(projectDir, 'my-app', {
      githubRepository: 'owner/my-app',
    })
  })

  it('runs every setup section in order', async () => {
    selectMock.mockResolvedValue('all')
    const {runSetupProject} = await import('../setup-project')

    await runSetupProject({dir: projectDir})

    expect(setupGitHubMock).toHaveBeenCalledOnce()
    expect(setupVercelMock).toHaveBeenCalledOnce()
    expect(setupMobileDeploymentMock).toHaveBeenCalledWith(projectDir)
  })

  it.each([
    ['mobile', setupMobileDeploymentMock],
    ['codemagic', runCodemagicBuildMock],
  ])('runs the %s setup section', async (action, operation) => {
    selectMock.mockResolvedValue(action)
    const {runSetupProject} = await import('../setup-project')

    await runSetupProject({dir: projectDir})

    expect(operation).toHaveBeenCalledWith(projectDir)
  })

  it.each([
    ['owner/my-app', 'GitHub: owner/my-app'],
    [undefined, 'GitHub: 연결되지 않음'],
  ])('reports GitHub status', async (repository, message) => {
    selectMock.mockResolvedValue('status')
    readGitHubRepositoryMock.mockResolvedValue(repository)
    await mkdir(join(projectDir, '.vercel'))
    await writeFile(join(projectDir, '.vercel/project.json'), '{}')
    const {runSetupProject} = await import('../setup-project')

    await runSetupProject({dir: projectDir})

    expect(logInfoMock).toHaveBeenCalledWith(message)
    expect(logInfoMock).toHaveBeenCalledWith('Vercel: 연결됨')
  })

  it('reports an unlinked Vercel project', async () => {
    selectMock.mockResolvedValue('status')
    readProjectSetupConfigMock.mockResolvedValue({
      schemaVersion: 1,
      mobile: {iosBundleId: 'com.example.ios', androidPackageName: 'com.example.android'},
      codemagic: {applicationId: 'app-id'},
    })
    const {runSetupProject} = await import('../setup-project')

    await runSetupProject({dir: projectDir})

    expect(logInfoMock).toHaveBeenCalledWith('Vercel: 연결되지 않음')
    expect(logInfoMock).toHaveBeenCalledWith('iOS: com.example.ios')
    expect(logInfoMock).toHaveBeenCalledWith('Android: com.example.android')
    expect(logInfoMock).toHaveBeenCalledWith('Codemagic: app-id')
  })

  it.each([
    [{dir: ''}, '프로젝트 폴더를 선택해주세요.'],
    [{dir: '/missing'}, '생성된 프로젝트 루트가 아닙니다. --dir 경로를 확인해주세요.'],
  ])('reports invalid project options', async (options, message) => {
    const {runSetupProject} = await import('../setup-project')

    await runSetupProject(options)

    expect(outroMock).toHaveBeenCalledWith(message)
    expect(process.exitCode).toBe(1)
  })

  it('reports an invalid package name', async () => {
    await writeFile(join(projectDir, 'package.json'), JSON.stringify({private: true}))
    const {runSetupProject} = await import('../setup-project')

    await runSetupProject({dir: projectDir})

    expect(outroMock).toHaveBeenCalledWith('프로젝트 package.json의 name을 확인해주세요.')
  })

  it.each([
    ['GitHub', setupGitHubMock],
    ['Vercel', setupVercelMock],
  ])('reports a failed %s CLI setup', async (action, setupOperation) => {
    selectMock.mockResolvedValue(action.toLowerCase())
    setupOperation.mockResolvedValue({status: 'failed', message: `${action} failed`})
    const {runSetupProject} = await import('../setup-project')

    await runSetupProject({dir: projectDir})

    expect(outroMock).toHaveBeenCalledWith(`${action} failed`)
    expect(process.exitCode).toBe(1)
  })

  it('formats unknown failures', async () => {
    selectMock.mockRejectedValue('unexpected')
    const {runSetupProject} = await import('../setup-project')

    await runSetupProject({dir: projectDir})

    expect(outroMock).toHaveBeenCalledWith('unexpected')
  })
})
