import {commandExists} from '../utils/command-exists'
import {runCommand} from '../utils/run-command'

/**
 * 생성된 프로젝트 폴더에서 의존성을 설치합니다.
 *
 * @param projectDir - 의존성을 설치할 프로젝트 폴더입니다.
 */
export async function installDependencies(projectDir: string) {
  if (await commandExists('pnpm')) {
    await runCommand('pnpm', ['i'], 'pnpm i', projectDir)
    return
  }

  await runCommand('npm', ['i'], 'npm i', projectDir)
}
