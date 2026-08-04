import {mkdtemp, readdir, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execaSync} from 'execa'
import {developmentCliArguments} from './development-workflow'

interface RunOptions {
  readonly env?: NodeJS.ProcessEnv
  readonly stdio?: 'inherit' | 'pipe'
}

function run(args: ReadonlyArray<string>, options: RunOptions = {}) {
  // execa는 Windows의 PATHEXT와 .cmd shim을 처리하므로 플랫폼별 실행 파일 이름이나 shell 분기가 필요 없다.
  // build, pack, CLI가 순서대로 같은 산출물을 사용하도록 동기 API로 각 명령의 종료를 기다린다.
  try {
    execaSync('pnpm', args, {stdio: options.stdio ?? 'inherit', env: options.env})
  } catch (error) {
    throw new Error(`pnpm ${args.join(' ')} 실행에 실패했습니다.`, {cause: error})
  }
}

async function main() {
  // 개발용 tarball은 생성 프로젝트에 복사할 때까지만 필요하므로 저장소 밖의 임시 폴더에 만든다.
  const packageDir = await mkdtemp(join(tmpdir(), 'create-vibe-start-dev-'))

  try {
    // npm에 배포될 파일과 같은 구성을 검증하기 위해 현재 소스를 먼저 빌드한 뒤 pnpm pack을 실행한다.
    run(['build'])
    run(['pack', '--pack-destination', packageDir], {stdio: 'pipe'})

    const packageFile = (await readdir(packageDir)).find((file) => file.endsWith('.tgz'))
    if (!packageFile) {
      throw new Error('pnpm pack 결과에서 create-vibe-start tarball을 찾을 수 없습니다.')
    }
    const packagePath = join(packageDir, packageFile)

    if (process.argv.includes('--verify')) {
      // CI도 pnpm dev와 동일한 tarball을 받아 생성, 설치, setup 실행까지 검증한다.
      run(['exec', 'vitest', 'run', 'test/e2e/__tests__/local-setup-package.e2e.spec.ts'], {
        env: {
          ...process.env,
          CREATE_VIBE_START_LOCAL_SETUP_PACKAGE: packagePath,
          VERIFY_LOCAL_SETUP_PACKAGE: '1',
        },
      })
      return
    }

    const providedArguments = process.argv.slice(2)
    const extraArguments = providedArguments[0] === '--' ? providedArguments.slice(1) : providedArguments
    // 일반 개발 실행에서는 사용자가 옵션을 붙이지 않아도 방금 만든 tarball 경로를 CLI에 전달한다.
    run(developmentCliArguments(packagePath, extraArguments))
  } finally {
    // 성공, 실패, 사용자 취소와 관계없이 저장소 밖의 임시 패키지를 남기지 않는다.
    await rm(packageDir, {recursive: true, force: true})
  }
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
