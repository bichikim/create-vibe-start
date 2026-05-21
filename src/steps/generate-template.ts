import {cp, readFile, stat} from 'node:fs/promises'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {log} from '@clack/prompts'
import nodePlop from 'node-plop'
import chalk from 'chalk'

type TemplateFile = {
  from: string
  to?: string
  template?: boolean
}

export type Answers = Record<string, unknown>

const defaultManifestFileName = 'template-manifest.json'
const defaultAnswers: Answers = {projectName: 'vibe-start-app'}

/** production 빌드(import.meta.env.PROD)는 패키지 옆 dist/templates, dev/test는 repo 루트 templates를 사용합니다. */
export function resolveDefaultTemplateDir(moduleUrl: string = import.meta.url): string {
  if (import.meta.env?.PROD) {
    return join(dirname(fileURLToPath(moduleUrl)), 'templates')
  }
  return 'templates'
}

/**
 * 선택된 작업 폴더에 초기 프로젝트 템플릿 파일을 생성합니다.
 *
 * @param projectDir - 템플릿 파일을 생성할 프로젝트 폴더입니다.
 * @param answers - 템플릿 경로와 내용의 Handlebars 표현식에 치환될 값입니다.
 * @param templateDir - 매니페스트와 템플릿 파일이 있는 폴더입니다.
 * @param manifestFileName - 읽어 들일 매니페스트 파일 이름입니다.
 */
export async function generateTemplate(
  projectDir: string,
  answers: Answers = {},
  templateDir: string = resolveDefaultTemplateDir(),
  manifestFileName: string = defaultManifestFileName,
) {
  log.step(chalk.bold('프로젝트 템플릿 생성'))

  const manifestPath = join(templateDir, manifestFileName)
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as TemplateFile[]
  await Promise.all(
    manifest
      .filter((file) => !file.template)
      .map((file) => {
        const source = join(templateDir, file.from)
        const destination = join(projectDir, file.to ?? file.from)

        return cp(source, destination, {recursive: true, force: true})
      }),
  )

  const actions = await Promise.all(
    manifest.filter((file) => file.template).map(async (file) => {
      const source = join(templateDir, file.from)
      const isDirectory = await stat(source).then((info) => info.isDirectory(), () => false)
      if (isDirectory) {
        return {
          type: 'addMany' as const,
          destination: join(projectDir, file.to ?? file.from),
          base: source,
          templateFiles: join(source, '**/*'),
          globOptions: {dot: true},
          force: true,
        }
      }
      return {
        type: 'add' as const,
        path: join(projectDir, file.to ?? file.from),
        templateFile: source,
        force: true,
      }
    }),
  )

  const plop = await nodePlop()
  const generator = plop.setGenerator('vibe-start', {
    description: 'Create the initial vibe project files.',
    prompts: [],
    actions,
  })
  const result = await generator.runActions({...defaultAnswers, ...answers})

  if (result.failures.length > 0) {
    throw new Error(result.failures.map((failure) => failure.error || failure.message).join('\n'))
  }

  log.message(chalk.green(`템플릿 파일 생성 완료: ${projectDir}`))
}
