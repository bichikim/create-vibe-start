import {mkdir, writeFile} from 'node:fs/promises'
import {dirname, join} from 'node:path'
import {spawnSync} from 'node:child_process'
import {homedir} from 'node:os'

const STUB_GH_VERSION = 'gh version 0.0.0-mock (mock-cli)'
const STUB_VERCEL_VERSION = 'Vercel CLI 0.0.0-mock'
const STUB_CODEX_VERSION = 'codex-cli 0.0.0-mock'

function mockOwner() {
  return process.env.MOCK_CLI_OWNER ?? 'mock-owner'
}

function mockProjectName(fallback = 'mock-project') {
  return process.env.MOCK_CLI_PROJECT_NAME ?? fallback
}

function vercelConfigDirectory() {
  if (process.env.MOCK_CLI_HOME) {
    return join(process.env.MOCK_CLI_HOME, 'com.vercel.cli')
  }

  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'com.vercel.cli')
  }

  if (process.platform === 'win32' && process.env.APPDATA) {
    return join(process.env.APPDATA, 'com.vercel.cli')
  }

  return join(process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'), 'com.vercel.cli')
}

/**
 * @param {string} bin
 * @param {string[]} args
 * @returns {Promise<{stdout?: string, stderr?: string, exitCode: number}>}
 */
export async function handleScenario(bin, args) {
  if (bin === 'gh') {
    return handleGh(args)
  }
  if (bin === 'vercel') {
    return handleVercel(args)
  }
  if (bin === 'codex') {
    return handleCodex(args)
  }

  return unsupported(bin, args)
}

/**
 * @param {string[]} args
 */
async function handleGh(args) {
  if (args[0] === '--version') {
    return {stdout: STUB_GH_VERSION, exitCode: 0}
  }

  if (args[0] === 'auth' && args[1] === 'status') {
    return {stdout: 'github.com\n  ✓ Logged in to github.com as mock-user', exitCode: 0}
  }

  if (args[0] === 'auth' && args[1] === 'login') {
    return {stdout: '✓ Logged in as mock-user', exitCode: 0}
  }

  if (args[0] === 'repo' && args[1] === 'create') {
    const projectName = args[2] ?? mockProjectName()
    ensureFakeOriginRemote(projectName)
    return {stdout: `https://github.com/${mockOwner()}/${projectName}`, exitCode: 0}
  }

  if (args[0] === 'repo' && args[1] === 'view') {
    const wantsNameWithOwner =
      args.includes('--json') &&
      args.includes('nameWithOwner') &&
      (args.includes('-q') || args.includes('--jq'))

    if (wantsNameWithOwner) {
      const projectName = mockProjectName(basenameFromCwd())
      return {stdout: `${mockOwner()}/${projectName}`, exitCode: 0}
    }
  }

  return unsupported('gh', args)
}

/**
 * @param {string[]} args
 */
async function handleVercel(args) {
  if (args[0] === '--version' || args[0] === '-v') {
    return {stdout: STUB_VERCEL_VERSION, exitCode: 0}
  }

  if (args[0] === 'whoami') {
    return {stdout: 'mock-vercel-user', exitCode: 0}
  }

  if (args[0] === 'login') {
    const authDir = vercelConfigDirectory()
    await mkdir(authDir, {recursive: true})
    await writeFile(join(authDir, 'auth.json'), `${JSON.stringify({token: 'mock-vercel-token'}, null, 2)}\n`)
    return {stdout: 'Congratulations! You are now signed in.', exitCode: 0}
  }

  if (args[0] === 'integration' && args[1] === 'add') {
    return {stdout: 'Integration added', exitCode: 0}
  }

  if (args[0] === 'env' && args[1] === 'pull') {
    const envFile = args[2]
    if (!envFile) {
      return {stderr: 'mock vercel: missing env pull target file', exitCode: 1}
    }

    await mkdir(dirname(envFile), {recursive: true})
    await writeFile(
      envFile,
      [
        'TURSO_DATABASE_URL=libsql://mock-db.turso.io',
        'TURSO_AUTH_TOKEN=mock-turso-token',
        'BETTER_AUTH_SECRET=mock-better-auth-secret',
        '',
      ].join('\n'),
    )
    return {stdout: `Created ${envFile} file`, exitCode: 0}
  }

  if (args[0] === '--prod') {
    return {stdout: `Production: https://${mockProjectName()}.vercel.app`, exitCode: 0}
  }

  return unsupported('vercel', args)
}

/**
 * @param {string[]} args
 */
async function handleCodex(args) {
  if (args[0] === '--version' || args[0] === '-V') {
    return {stdout: STUB_CODEX_VERSION, exitCode: 0}
  }

  if (args[0] === 'login' && args[1] === 'status') {
    return {stdout: 'Logged in', exitCode: 0}
  }

  if (args[0] === 'login') {
    return {stdout: 'Successfully logged in', exitCode: 0}
  }

  return unsupported('codex', args)
}

/**
 * @param {string} bin
 * @param {string[]} args
 */
function unsupported(bin, args) {
  return {
    stderr: `mock ${bin}: unsupported args: ${args.join(' ')}`,
    exitCode: 1,
  }
}

/**
 * @param {string} projectName
 */
function ensureFakeOriginRemote(projectName) {
  const remoteCheck = spawnSync('git', ['remote', 'get-url', 'origin'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  if (remoteCheck.status === 0) {
    return
  }

  spawnSync(
    'git',
    ['remote', 'add', 'origin', `https://github.com/${mockOwner()}/${projectName}.git`],
    {encoding: 'utf8', stdio: 'ignore'},
  )
}

function basenameFromCwd() {
  const parts = process.cwd().split(/[/\\]/u).filter(Boolean)
  return parts.at(-1) ?? 'mock-project'
}

export const stubVersions = {
  gh: STUB_GH_VERSION,
  vercel: STUB_VERCEL_VERSION,
  codex: STUB_CODEX_VERSION,
}
