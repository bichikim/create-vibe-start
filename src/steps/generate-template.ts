import {copyFile, cp, mkdir, readdir, readFile, stat, writeFile} from 'node:fs/promises'
import {dirname, isAbsolute, join, relative, resolve, sep} from 'node:path'
import {fileURLToPath} from 'node:url'
import {log} from '@clack/prompts'
import chalk from 'chalk'
import Handlebars from 'handlebars'
import packageJson from '../../package.json'
import {resolveCliVersion} from '../core/resolve-cli-version'
import {isRecord} from '../utils/is-record'

interface TemplateFile {
  readonly from: string
  readonly to?: string
  readonly template?: boolean
}

interface TemplateManifest {
  readonly files: ReadonlyArray<TemplateFile>
}

interface TemplateAction {
  readonly source: string
  readonly destination: string
  readonly template: boolean
}

export interface Answers {
  [key: string]: unknown
}

export type TemplateSetupRuntime =
  | {readonly kind: 'published'}
  | {readonly kind: 'local-package'; readonly packagePath: string}

interface GenerateTemplateOptions {
  readonly manifestFileName?: string
  readonly setupRuntime?: TemplateSetupRuntime
}

const DEFAULT_MANIFEST_FILE_NAME = 'template-manifest.json'
const DEFAULT_ANSWERS: Answers = {projectName: 'vibe-start-app'}

function nativeAppIdFromProjectName(projectName: unknown) {
  const suffix = typeof projectName === 'string' ? projectName.toLowerCase().replaceAll(/[^a-z0-9]/gu, '') : ''

  return `com.vibestart.${suffix || 'app'}`
}

function templateAnswers(answers: Answers, runtime: TemplateSetupRuntime) {
  const mergedAnswers = {...DEFAULT_ANSWERS, ...answers}

  if (typeof mergedAnswers.nativeAppId !== 'string' || !mergedAnswers.nativeAppId.trim()) {
    mergedAnswers.nativeAppId = nativeAppIdFromProjectName(mergedAnswers.projectName)
  }

  if (runtime.kind === 'local-package') {
    mergedAnswers.setupCommand = 'create-vibe-start setup --dir .'
    mergedAnswers.localSetupPackage = true
  } else {
    const cliVersion =
      typeof mergedAnswers.cliVersion === 'string' && mergedAnswers.cliVersion.trim()
        ? mergedAnswers.cliVersion.trim()
        : resolveCliVersion(packageJson)
    mergedAnswers.cliVersion = cliVersion
    mergedAnswers.setupCommand = `pnpm dlx create-vibe-start@${cliVersion} setup --dir .`
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
 * @param options - 매니페스트 파일과 생성 프로젝트의 setup runtime 설정입니다.
 */
export async function generateTemplate(
  projectDir: string,
  answers: Answers = {},
  templateDir: string = resolveDefaultTemplateDir(),
  options: GenerateTemplateOptions = {},
): Promise<void> {
  log.step(chalk.bold('프로젝트 템플릿 생성'))

  const manifestFileName = options.manifestFileName ?? DEFAULT_MANIFEST_FILE_NAME
  const setupRuntime = options.setupRuntime ?? {kind: 'published'}
  const manifestPath = join(templateDir, manifestFileName)
  const manifest = parseTemplateManifest(await readFile(manifestPath, 'utf8'))
  const actions = templateActions(manifest, templateDir, projectDir)
  await Promise.all(
    actions
      .filter((action) => !action.template)
      .map((action) => cp(action.source, action.destination, {recursive: true, force: true})),
  )

  const resolvedAnswers = templateAnswers(answers, setupRuntime)
  await Promise.all(
    actions
      .filter((action) => action.template)
      .map((action) => renderTemplatePath(action.source, action.destination, resolvedAnswers)),
  )

  if (setupRuntime.kind === 'local-package') {
    const packageDir = join(projectDir, '.vibe-start')
    await mkdir(packageDir, {recursive: true})
    try {
      await copyFile(setupRuntime.packagePath, join(packageDir, 'create-vibe-start.tgz'))
    } catch (error) {
      throw new Error(`로컬 setup package tarball을 복사할 수 없습니다: ${setupRuntime.packagePath}`, {
        cause: error,
      })
    }
  }

  log.message(chalk.green(`템플릿 파일 생성 완료: ${projectDir}`))
}

function isTemplateFile(value: unknown): value is TemplateFile {
  return (
    isRecord(value) &&
    typeof value.from === 'string' &&
    value.from.length > 0 &&
    (value.to === undefined || (typeof value.to === 'string' && value.to.length > 0)) &&
    (value.template === undefined || typeof value.template === 'boolean')
  )
}

function parseTemplateManifest(content: string): TemplateManifest {
  let value: unknown
  try {
    value = JSON.parse(content)
  } catch (error) {
    throw new Error('템플릿 매니페스트가 올바른 JSON이 아닙니다.', {cause: error})
  }

  if (!isRecord(value) || !Array.isArray(value.files) || !value.files.every(isTemplateFile)) {
    throw new Error('템플릿 매니페스트의 files 형식이 올바르지 않습니다.')
  }

  return {files: value.files}
}

function templateActions(
  manifest: TemplateManifest,
  templateDir: string,
  projectDir: string,
): ReadonlyArray<TemplateAction> {
  const projectRoot = resolve(projectDir)
  return manifest.files.map((file) => {
    const destination = resolve(projectRoot, file.to ?? file.from)
    const relativeDestination = relative(projectRoot, destination)
    // Windows can return an absolute path when project and destination are on different drives.
    /* v8 ignore next */
    const outsideDrive = isAbsolute(relativeDestination)
    if (relativeDestination === '..' || relativeDestination.startsWith(`..${sep}`) || outsideDrive) {
      throw new Error(`템플릿 출력 경로가 프로젝트 폴더를 벗어납니다: ${file.to ?? file.from}`)
    }

    return {
      source: join(templateDir, file.from),
      destination,
      template: file.template === true,
    }
  })
}
