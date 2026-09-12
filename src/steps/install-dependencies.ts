import {mkdir, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {commandExists} from '../utils/command-exists'
import {runCommand} from '../utils/run-command'

const PNPM_VERSION = '11.1.2'
const PLACEHOLDER_INDEX_HTML = '<!doctype html><title>vibe</title>\n'

/**
 * 생성된 프로젝트 폴더에서 의존성을 설치합니다.
 *
 * @param projectDir - 의존성을 설치할 프로젝트 폴더입니다.
 */
export async function installDependencies(projectDir: string): Promise<boolean> {
  if (!(await commandExists('pnpm'))) {
    if (!(await commandExists('corepack'))) {
      throw new Error('이 템플릿은 pnpm이 필요합니다. pnpm을 설치하거나 Corepack을 활성화해주세요.')
    }

    await runCommand('corepack', ['enable', 'pnpm'], 'corepack enable pnpm')
    await runCommand(
      'corepack',
      ['prepare', `pnpm@${PNPM_VERSION}`, '--activate'],
      `corepack prepare pnpm@${PNPM_VERSION} --activate`,
    )

    if (!(await commandExists('pnpm'))) {
      throw new Error('Corepack으로 pnpm을 활성화했지만 pnpm 명령을 찾을 수 없습니다.')
    }
  }

  await runCommand('pnpm', ['i'], 'pnpm i', projectDir)

  const appDir = join(projectDir, 'apps/main-app')
  // Capacitor writes capacitor.plugins.json here and copies webDir when missing.
  await mkdir(join(appDir, 'android/app/src/main/assets'), {recursive: true})
  await mkdir(join(appDir, 'dist'), {recursive: true})
  await writeFile(join(appDir, 'dist/index.html'), PLACEHOLDER_INDEX_HTML)

  // Regenerate Capacitor's Android Gradle links from the installed package paths.
  await runCommand(
    'pnpm',
    ['exec', 'cap', 'update', 'android'],
    'pnpm exec cap update android',
    appDir,
  )
  return true
}
