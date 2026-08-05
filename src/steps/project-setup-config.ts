import {readFile, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {z} from 'zod'

export interface ProjectSetupConfig {
  readonly schemaVersion: 1
  readonly mobile?: {
    readonly iosBundleId?: string
    readonly androidPackageName?: string
  }
  readonly codemagic?: {
    readonly applicationId: string
  }
}

const EMPTY_CONFIG: ProjectSetupConfig = {schemaVersion: 1}
const nonEmptyString = z.string().trim().min(1)
const projectSetupConfigSchema: z.ZodType<ProjectSetupConfig> = z.object({
  schemaVersion: z.literal(1),
  mobile: z
    .object({
      iosBundleId: nonEmptyString.optional(),
      androidPackageName: nonEmptyString.optional(),
    })
    .optional(),
  codemagic: z.object({applicationId: nonEmptyString}).optional(),
})

/** 반복 실행에 필요한 공개 식별자만 읽고, 파일이 없으면 최초 설정 상태를 반환한다. */
export async function readProjectSetupConfig(projectDir: string): Promise<ProjectSetupConfig> {
  let content: string
  try {
    content = await readFile(configPath(projectDir), 'utf8')
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      return EMPTY_CONFIG
    }
    throw new Error('프로젝트 설정 파일을 읽을 수 없습니다.', {cause: error})
  }

  try {
    return projectSetupConfigSchema.parse(JSON.parse(content))
  } catch (error) {
    throw new Error('프로젝트 설정 파일의 형식이 올바르지 않습니다.', {cause: error})
  }
}

/** 다음 setup 실행이 이어받을 수 있도록 공개 식별자를 프로젝트 루트에 기록한다. */
export async function writeProjectSetupConfig(projectDir: string, config: ProjectSetupConfig) {
  // 이 파일에는 공개 가능한 App ID와 Codemagic Application ID만 저장하고 token은 저장하지 않는다.
  await writeFile(configPath(projectDir), `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

function configPath(projectDir: string) {
  return join(projectDir, 'vibe-start.config.json')
}

function hasErrorCode(error: unknown, code: string) {
  return error instanceof Error && 'code' in error && error.code === code
}
