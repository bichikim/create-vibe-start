import {chmod, mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import {pathToFileURL, fileURLToPath} from 'node:url'
import {readCalls} from '../lib/record.mjs'

const mockCliRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const runBinUrl = pathToFileURL(join(mockCliRoot, 'lib', 'run-bin.mjs')).href

export type MockCliCall = {
  bin: string
  args: string[]
  cwd?: string
  ts: string
}

export type MockCliSessionOptions = {
  owner?: string
  projectName?: string
}

export type MockCliSession = {
  pathPrefix: string
  env: NodeJS.ProcessEnv
  logPath: string
  homePath: string
  readCalls: () => Promise<MockCliCall[]>
  cleanup: () => Promise<void>
}

const MOCK_BINS = ['gh', 'vercel', 'codex'] as const

/**
 * Install mock `gh`/`vercel`/`codex` binaries on a temporary PATH prefix.
 */
export async function createMockCliSession(options: MockCliSessionOptions = {}): Promise<MockCliSession> {
  const root = await mkdtemp(join(tmpdir(), 'mock-cli-'))
  const pathPrefix = join(root, 'bin')
  const logPath = join(root, 'calls.jsonl')
  const homePath = join(root, 'home')

  await writeMockBins(pathPrefix)

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${pathPrefix}${pathDelimiter()}${process.env.PATH ?? ''}`,
    MOCK_CLI_LOG: logPath,
    MOCK_CLI_HOME: homePath,
    MOCK_CLI_OWNER: options.owner ?? 'mock-owner',
    MOCK_CLI_PROJECT_NAME: options.projectName ?? 'mock-project',
  }

  return {
    pathPrefix,
    env,
    logPath,
    homePath,
    readCalls: () => readCalls(logPath) as Promise<MockCliCall[]>,
    cleanup: async () => {
      await rm(root, {recursive: true, force: true})
    },
  }
}

async function writeMockBins(pathPrefix: string) {
  await mkdir(pathPrefix, {recursive: true})

  for (const bin of MOCK_BINS) {
    const target = join(pathPrefix, bin)
    await writeFile(
      target,
      [
        '#!/usr/bin/env node',
        `import {runMockCli} from ${JSON.stringify(runBinUrl)}`,
        `await runMockCli(${JSON.stringify(bin)}, process.argv.slice(2))`,
        '',
      ].join('\n'),
      'utf8',
    )
    await chmod(target, 0o755)

    if (process.platform === 'win32') {
      await writeFile(
        join(pathPrefix, `${bin}.cmd`),
        `@echo off\r\nnode "%~dp0${bin}" %*\r\n`,
        'utf8',
      )
    }
  }
}

function pathDelimiter() {
  return process.platform === 'win32' ? ';' : ':'
}
