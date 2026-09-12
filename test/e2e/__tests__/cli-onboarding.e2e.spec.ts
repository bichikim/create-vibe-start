import {access, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {createPromptAnswerQueue, type PromptAnswerQueue} from '../../mock-cli/helpers/prompt-answers'
import {createVercelFetchStub} from '../../mock-cli/helpers/vercel-api-stub'
import {createMockCliSession, type MockCliSession} from '../../mock-cli/helpers/with-mock-path'

const confirmMock = vi.fn()
const textMock = vi.fn()
const selectMock = vi.fn()
const multiselectMock = vi.fn()

vi.mock('@clack/prompts', async () => {
  const actual = await vi.importActual<typeof import('@clack/prompts')>('@clack/prompts')
  return {
    ...actual,
    confirm: confirmMock,
    text: textMock,
    select: selectMock,
    multiselect: multiselectMock,
  }
})

describe('CLI onboarding e2e (mocked external CLIs)', () => {
  let session: MockCliSession | undefined
  let workspaceDir: string | undefined
  let previousPath: string | undefined
  let previousVercelToken: string | undefined
  let previousGitConfigGlobal: string | undefined
  let previousGitConfigSystem: string | undefined
  let prompts: PromptAnswerQueue

  beforeEach(async () => {
    session = await createMockCliSession({owner: 'mock-owner', projectName: 'e2e-demo-app'})
    workspaceDir = await mkdtemp(join(tmpdir(), 'cvs-e2e-'))
    const projectDir = join(workspaceDir, 'e2e-demo-app')
    const gitConfigPath = join(session.homePath, 'gitconfig')
    await mkdir(session.homePath, {recursive: true})
    await writeFile(
      gitConfigPath,
      ['[user]', '\tname = E2E User', '\temail = e2e@example.com', ''].join('\n'),
      'utf8',
    )

    previousPath = process.env.PATH
    previousVercelToken = process.env.VERCEL_TOKEN
    previousGitConfigGlobal = process.env.GIT_CONFIG_GLOBAL
    previousGitConfigSystem = process.env.GIT_CONFIG_SYSTEM
    process.env.PATH = session.env.PATH
    process.env.MOCK_CLI_LOG = session.env.MOCK_CLI_LOG
    process.env.MOCK_CLI_HOME = session.env.MOCK_CLI_HOME
    process.env.MOCK_CLI_OWNER = session.env.MOCK_CLI_OWNER
    process.env.MOCK_CLI_PROJECT_NAME = session.env.MOCK_CLI_PROJECT_NAME
    process.env.VERCEL_TOKEN = 'mock-vercel-token'
    process.env.GIT_CONFIG_GLOBAL = gitConfigPath
    process.env.GIT_CONFIG_SYSTEM = '/dev/null'

    vi.stubGlobal('fetch', createVercelFetchStub({
      projectId: 'prj_e2e',
      accountId: 'team_e2e',
      deploymentUrl: 'e2e-demo-app.vercel.app',
    }))

    prompts = createPromptAnswerQueue([
      true, // welcome
      true, // create project?
      'e2e-demo-app', // project name
      projectDir, // project dir
      true, // create github repo?
      true, // deploy vercel?
      [], // skip codex/dev follow-ups
    ])

    confirmMock.mockReset().mockImplementation(async () => prompts.confirm())
    textMock.mockReset().mockImplementation(async () => prompts.text())
    selectMock.mockReset().mockImplementation(async () => prompts.select())
    multiselectMock.mockReset().mockImplementation(async () => prompts.multiselect())
    process.exitCode = undefined
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    if (previousPath === undefined) {
      delete process.env.PATH
    } else {
      process.env.PATH = previousPath
    }
    if (previousVercelToken === undefined) {
      delete process.env.VERCEL_TOKEN
    } else {
      process.env.VERCEL_TOKEN = previousVercelToken
    }
    if (previousGitConfigGlobal === undefined) {
      delete process.env.GIT_CONFIG_GLOBAL
    } else {
      process.env.GIT_CONFIG_GLOBAL = previousGitConfigGlobal
    }
    if (previousGitConfigSystem === undefined) {
      delete process.env.GIT_CONFIG_SYSTEM
    } else {
      process.env.GIT_CONFIG_SYSTEM = previousGitConfigSystem
    }
    delete process.env.MOCK_CLI_LOG
    delete process.env.MOCK_CLI_HOME
    delete process.env.MOCK_CLI_OWNER
    delete process.env.MOCK_CLI_PROJECT_NAME

    await session?.cleanup()
    session = undefined
    if (workspaceDir) {
      await rm(workspaceDir, {recursive: true, force: true})
      workspaceDir = undefined
    }
  })

  it('generates a project, mocks GitHub create, and mocks Vercel deploy', async () => {
    const {runCli} = await import('../../../src/cli')
    const projectDir = join(workspaceDir!, 'e2e-demo-app')

    await runCli(['node', 'create-vibe-start', '--project-dir', projectDir])

    await access(join(projectDir, 'package.json'))
    await access(join(projectDir, 'apps/main-app/package.json'))
    await access(join(projectDir, '.vercel/project.json'))

    const link = JSON.parse(await readFile(join(projectDir, '.vercel/project.json'), 'utf8')) as {
      orgId: string
      projectId: string
    }
    expect(link).toEqual({orgId: 'team_e2e', projectId: 'prj_e2e'})

    const calls = await session!.readCalls()
    const summarized = calls.map((call) => [call.bin, call.args[0], call.args[1]].filter(Boolean))

    expect(summarized).toEqual(expect.arrayContaining([
      ['gh', 'auth', 'status'],
      ['vercel', 'whoami'],
      ['codex', 'login', 'status'],
      ['pnpm', 'i'],
      ['pnpm', 'exec', 'cap'],
      ['gh', 'repo', 'create'],
      ['gh', 'repo', 'view'],
      ['vercel', 'integration', 'add'],
      ['vercel', 'env', 'pull'],
      ['pnpm', 'db:migrate'],
      ['vercel', '--prod'],
    ]))

    expect(prompts.remaining()).toBe(0)
  }, 60_000)
})
