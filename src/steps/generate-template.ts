import {readFile} from 'node:fs/promises'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {log} from '@clack/prompts'
import nodePlop from 'node-plop'
import chalk from 'chalk'

type TemplateFile = {
  from: string
  to?: string
}

const moduleDir = dirname(fileURLToPath(import.meta.url))
const templateDir = moduleDir.endsWith('/steps') ? join(moduleDir, '..', 'templates') : join(moduleDir, 'templates')
const manifestPath = join(templateDir, 'template-manifest.json')

/**
 * 선택된 작업 폴더에 초기 프로젝트 템플릿 파일을 생성합니다.
 *
 * @param projectDir - 템플릿 파일을 생성할 프로젝트 폴더입니다.
 */
export async function generateTemplate(projectDir: string) {
  log.step(chalk.bold('프로젝트 템플릿 생성'))

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as TemplateFile[]
  const actions = manifest.map((file) => ({
    type: 'add' as const,
    path: join(projectDir, file.to ?? file.from),
    templateFile: join(templateDir, file.from),
    force: true,
  }))

  const plop = await nodePlop()
  const generator = plop.setGenerator('vibe-start', {
    description: 'Create the initial vibe project files.',
    prompts: [],
    actions,
  })
  const result = await generator.runActions({})

  if (result.failures.length > 0) {
    throw new Error(result.failures.map((failure) => failure.error || failure.message).join('\n'))
  }

  log.message(chalk.green(`템플릿 파일 생성 완료: ${projectDir}`))
}
