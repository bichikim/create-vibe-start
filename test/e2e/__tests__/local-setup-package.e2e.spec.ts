import {mkdtemp, readFile, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execa} from 'execa'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {developmentCliArguments} from '../../../scripts/development-workflow'
import {generateTemplate} from '../../../src/steps/generate-template'

const enabled = process.env.VERIFY_LOCAL_SETUP_PACKAGE === '1'

describe.runIf(enabled)('local setup package e2e', () => {
  let workspaceDir: string
  let projectDir: string
  let packagePath: string

  beforeAll(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'cvs-local-setup-'))
    projectDir = join(workspaceDir, 'generated-project')
    const preparedPackagePath = process.env.CREATE_VIBE_START_LOCAL_SETUP_PACKAGE
    if (!preparedPackagePath) {
      throw new Error('개발 워크플로가 준비한 create-vibe-start tarball 경로가 없습니다.')
    }

    // pnpm dev가 만든 실제 tarball 경로가 생성 CLI의 옵션으로 전달되는지 먼저 확인한다.
    const cliArguments = developmentCliArguments(preparedPackagePath)
    const optionIndex = cliArguments.indexOf('--local-setup-package')
    packagePath = cliArguments[optionIndex + 1] ?? ''
    expect(packagePath).toBe(preparedPackagePath)

    await generateTemplate(projectDir, {projectName: 'local-setup-e2e'}, undefined, {
      setupRuntime: {kind: 'local-package', packagePath},
    })
  }, 30_000)

  afterAll(async () => {
    await rm(workspaceDir, {recursive: true, force: true})
  })

  it('installs the packed CLI and runs the generated setup command', async () => {
    const generatedPackage = JSON.parse(await readFile(join(projectDir, 'package.json'), 'utf8')) as {
      scripts: {setup: string}
      devDependencies: Record<string, string>
    }

    expect(generatedPackage.scripts.setup).toBe('create-vibe-start setup --dir .')
    expect(generatedPackage.devDependencies['create-vibe-start']).toBe('file:.vibe-start/create-vibe-start.tgz')
    // 파일 이름만 같은 가짜 fixture가 아니라 방금 pack한 바이트가 그대로 포함됐는지 비교한다.
    const sourcePackage = await readFile(packagePath)
    const embeddedPackage = await readFile(join(projectDir, '.vibe-start/create-vibe-start.tgz'))
    expect(embeddedPackage.equals(sourcePackage)).toBe(true)

    // 생성 프로젝트의 실제 pnpm 경로를 사용해 로컬 file 의존성과 bin 연결을 함께 검증한다.
    await execa('pnpm', ['install', '--no-frozen-lockfile', '--ignore-scripts'], {
      cwd: projectDir,
      timeout: 120_000,
    })
    const setup = await execa('pnpm', ['run', 'setup', '--check'], {
      cwd: projectDir,
      timeout: 30_000,
    })

    expect(setup.stdout).toContain('프로젝트 setup runtime 확인 완료: local-setup-e2e')

    // setup 마법사가 호출하는 플랫폼별 App ID 명령도 pnpm 인자 전달까지 실제로 실행한다.
    await execa('pnpm', ['run', 'app-id', 'ios', 'com.example.localsetup'], {
      cwd: projectDir,
      timeout: 30_000,
    })
    await expect(
      readFile(join(projectDir, 'apps/main-app/ios/App/App.xcodeproj/project.pbxproj'), 'utf8'),
    ).resolves.toContain('PRODUCT_BUNDLE_IDENTIFIER = com.example.localsetup;')
    await expect(readFile(join(projectDir, 'apps/main-app/android/app/build.gradle'), 'utf8')).resolves.toContain(
      'applicationId "com.vibestart.localsetupe2e"',
    )
  }, 180_000)
})
