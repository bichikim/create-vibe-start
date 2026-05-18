import {mkdir, readFile, writeFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {log} from '@clack/prompts'
import {commandExists} from '../utils/command-exists'
import {runCommand, runCommandQuietly} from '../utils/run-command'
import {type SetupStep, setupTool} from './setup-tool'

const defaultPlugins = [
  'github@openai-curated',
  'vercel@openai-curated',
  'openai-developers@openai-curated',
  'build-web-apps@openai-curated',
]

/** Codex CLI 설치, 버전 확인, 로그인 상태 확인을 수행합니다. */
export const setupCodex: SetupStep = async () => {
  const installCommand = (await commandExists('pnpm'))
    ? {
        command: 'pnpm',
        args: ['add', '-g', '@openai/codex'],
        label: 'pnpm add -g @openai/codex',
      }
    : {
        command: 'npm',
        args: ['install', '-g', '@openai/codex'],
        label: 'npm install -g @openai/codex',
      }

  const result = await setupTool({
    name: 'Codex',
    command: 'codex',
    versionArgs: ['--version'],
    authCheckArgs: ['login', 'status'],
    loginArgs: ['login'],
    install: {
      macos: installCommand,
      windows: installCommand,
      linux: installCommand,
    },
  })

  if (result.status === 'ready') {
    await setupCodexPlugins()
  }

  return result
}

/** Codex 공식 플러그인 마켓플레이스와 기본 플러그인을 준비합니다. */
async function setupCodexPlugins() {
  try {
    if (!(await hasOpenAiMarketplace())) {
      await runCommand(
        'codex',
        ['plugin', 'marketplace', 'add', 'openai/plugins'],
        'codex plugin marketplace add openai/plugins',
      )
    }
    await enableDefaultPlugins()
  } catch (error) {
    log.warn(`Codex 기본 플러그인 설치 실패: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function hasOpenAiMarketplace() {
  try {
    const result = await runCommandQuietly('codex', ['plugin', 'marketplace', 'list'])
    const output = `${result.stdout}\n${result.stderr}`
    return output.includes('openai-curated') || output.includes('openai/plugins')
  } catch {
    return false
  }
}

/** Codex 설정 파일에 기본 플러그인 활성화 블록을 추가합니다. */
export async function enableDefaultPlugins(configPath = path.join(os.homedir(), '.codex', 'config.toml')) {
  await mkdir(path.dirname(configPath), {recursive: true})

  const config = await readConfig(configPath)
  const additions = defaultPlugins
    .filter((plugin) => !config.includes(`[plugins."${plugin}"]`))
    .map((plugin) => `[plugins."${plugin}"]\nenabled = true`)

  if (additions.length === 0) {
    return
  }

  const separator = config.trim() ? '\n\n' : ''
  await writeFile(configPath, `${config}${separator}${additions.join('\n\n')}\n`)
}

async function readConfig(configPath: string) {
  try {
    return await readFile(configPath, 'utf8')
  } catch (error) {
    if (isMissingFile(error)) {
      return ''
    }
    throw error
  }
}

function isMissingFile(error: unknown) {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
