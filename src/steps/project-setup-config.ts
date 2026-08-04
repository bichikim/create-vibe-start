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
    return EMPTY_CONFIG
  }
}

export async function writeProjectSetupConfig(projectDir: string, config: ProjectSetupConfig) {
  await writeFile(configPath(projectDir), `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

function configPath(projectDir: string) {
  return join(projectDir, 'vibe-start.config.json')
}

function isProjectSetupConfig(value: unknown): value is ProjectSetupConfig {
  return isRecord(value) && value.schemaVersion === 1
}
