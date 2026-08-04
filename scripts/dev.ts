import {spawnSync} from 'node:child_process'
import {mkdtemp, readdir, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {developmentCliArguments} from './development-workflow'

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

interface RunOptions {
  readonly env?: NodeJS.ProcessEnv
  readonly stdio?: 'inherit' | 'pipe'
}

function run(args: ReadonlyArray<string>, options: RunOptions = {}) {
  const result = spawnSync(pnpm, Array.from(args), {stdio: options.stdio ?? 'inherit', env: options.env})
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`pnpm ${args.join(' ')} 실행에 실패했습니다.`, {cause: result})
  }
}

async function main() {
  const packageDir = await mkdtemp(join(tmpdir(), 'create-vibe-start-dev-'))

  try {
    run(['build'])
    run(['pack', '--pack-destination', packageDir], {stdio: 'pipe'})

    const packageFile = (await readdir(packageDir)).find((file) => file.endsWith('.tgz'))
    if (!packageFile) {
      throw new Error('pnpm pack 결과에서 create-vibe-start tarball을 찾을 수 없습니다.')
    }
    const packagePath = join(packageDir, packageFile)

    if (process.argv.includes('--verify')) {
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
    run(developmentCliArguments(packagePath, extraArguments))
  } finally {
    await rm(packageDir, {recursive: true, force: true})
  }
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
