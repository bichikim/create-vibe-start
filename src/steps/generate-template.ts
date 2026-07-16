import {cp, mkdir, readdir, readFile, stat, writeFile} from 'node:fs/promises'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {log} from '@clack/prompts'
import chalk from 'chalk'
import Handlebars from 'handlebars'

type TemplateFile = {
  from: string
  to?: string
  template?: boolean
}

type TemplateManifest = {
  files: TemplateFile[]
}

export type Answers = Record<string, unknown>

const defaultManifestFileName = 'template-manifest.json'
const defaultAnswers: Answers = {projectName: 'vibe-start-app'}

function nativeAppIdFromProjectName(projectName: unknown) {
  const suffix = typeof projectName === 'string' ? projectName.toLowerCase().replaceAll(/[^a-z0-9]/gu, '') : ''

  return `com.vibestart.${suffix || 'app'}`
}

function templateAnswers(answers: Answers) {
  const mergedAnswers = {...defaultAnswers, ...answers}

  if (typeof mergedAnswers.nativeAppId !== 'string' || !mergedAnswers.nativeAppId.trim()) {
    mergedAnswers.nativeAppId = nativeAppIdFromProjectName(mergedAnswers.projectName)
  }

  return mergedAnswers
}

async function renderTemplatePath(source: string, destination: string, answers: Answers) {
  const sourceStat = await stat(source)
  if (sourceStat.isDirectory()) {
    await mkdir(destination, {recursive: true})
    await Promise.all(
      (await readdir(source)).map((entry) =>
        renderTemplatePath(join(source, entry), join(destination, entry), answers),
      ),
    )
    return
  }

  const template = Handlebars.compile(await readFile(source, 'utf8'), {noEscape: true})
  await mkdir(dirname(destination), {recursive: true})
  await writeFile(destination, template(answers), 'utf8')
}

/** Resolves templates from the module location so CLI execution never depends on the current directory. */
export function resolveDefaultTemplateDir(moduleUrl: string = import.meta.url): string {
  const moduleDir = dirname(fileURLToPath(moduleUrl))
  if (import.meta.env?.PROD) {
    return join(moduleDir, 'templates')
  }
  return join(moduleDir, '..', '..', 'templates')
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
  const {files} = JSON.parse(await readFile(manifestPath, 'utf8')) as TemplateManifest
  await Promise.all(
    files
      .filter((file) => !file.template)
      .map((file) => {
        const source = join(templateDir, file.from)
        const destination = join(projectDir, file.to ?? file.from)

        return cp(source, destination, {recursive: true, force: true})
      }),
  )

  const resolvedAnswers = templateAnswers(answers)
  await Promise.all(
    files
      .filter((file) => file.template)
      .map((file) =>
        renderTemplatePath(join(templateDir, file.from), join(projectDir, file.to ?? file.from), resolvedAnswers),
      ),
  )

  log.message(chalk.green(`템플릿 파일 생성 완료: ${projectDir}`))
}
