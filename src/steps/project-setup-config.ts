import {readFile, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {isRecord} from '../utils/is-record'

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

export async function readProjectSetupConfig(projectDir: string): Promise<ProjectSetupConfig> {
  try {
    const value: unknown = JSON.parse(await readFile(configPath(projectDir), 'utf8'))
    return isProjectSetupConfig(value) ? value : EMPTY_CONFIG
  } catch {
    // 설정 파일이 없거나 읽을 수 없으면 빈 상태로 시작해 마법사에서 다시 설정할 수 있게 한다.
    return EMPTY_CONFIG
  }
}

export async function writeProjectSetupConfig(projectDir: string, config: ProjectSetupConfig) {
  // 이 파일에는 공개 가능한 App ID와 Codemagic Application ID만 저장하고 token은 저장하지 않는다.
  await writeFile(configPath(projectDir), `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

function configPath(projectDir: string) {
  return join(projectDir, 'vibe-start.config.json')
}

function isProjectSetupConfig(value: unknown): value is ProjectSetupConfig {
  return isRecord(value) && value.schemaVersion === 1
}
