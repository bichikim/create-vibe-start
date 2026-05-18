import {beforeEach, describe, expect, it, vi} from 'vitest'

const mkdirMock = vi.fn()
const readFileMock = vi.fn()
const writeFileMock = vi.fn()
const runCommandMock = vi.fn()
const logStepMock = vi.fn()
const logMessageMock = vi.fn()
const fetchMock = vi.fn()

vi.mock('node:fs/promises', () => ({
  mkdir: mkdirMock,
  readFile: readFileMock,
  writeFile: writeFileMock,
}))

vi.mock('../../utils/run-command.js', () => ({
  runCommand: runCommandMock,
}))

vi.mock('@clack/prompts', () => ({
  log: {
    step: logStepMock,
    message: logMessageMock,
  },
}))

describe('deployVercelProject', () => {
  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({id: 'prj_123', accountId: 'team_123'}),
    })
    vi.stubGlobal('fetch', fetchMock)
    mkdirMock.mockReset().mockResolvedValue(undefined)
    readFileMock.mockReset().mockResolvedValue('{"token":"file-token"}')
    writeFileMock.mockReset().mockResolvedValue(undefined)
    runCommandMock.mockReset().mockResolvedValue(undefined)
    logStepMock.mockReset()
    logMessageMock.mockReset()
    delete process.env.VERCEL_TOKEN
  })

  it('creates a Git-connected Vercel project, writes local link metadata, and deploys to production', async () => {
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await deployVercelProject('/repo/my-app', 'my-app', 'bichikim/my-app')

    expect(fetchMock).toHaveBeenCalledWith('https://api.vercel.com/v11/projects', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer file-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        framework: 'nitro',
        gitRepository: {
          repo: 'bichikim/my-app',
          type: 'github',
        },
        name: 'my-app',
        rootDirectory: 'apps/main-app',
      }),
    })
    expect(mkdirMock).toHaveBeenCalledWith('/repo/my-app/.vercel', {recursive: true})
    expect(writeFileMock).toHaveBeenCalledWith(
      '/repo/my-app/.vercel/project.json',
      `${JSON.stringify({orgId: 'team_123', projectId: 'prj_123'}, null, 2)}\n`,
    )
    expect(runCommandMock).toHaveBeenNthCalledWith(
      1,
      'vercel',
      [
        'integration',
        'add',
        'tursocloud/database',
        '--name',
        'my-app',
        '--metadata',
        'region=iad1',
        '--plan',
        'starter',
        '--environment',
        'production',
        '--no-env-pull',
      ],
      'vercel integration add tursocloud/database',
      '/repo/my-app',
    )
    expect(runCommandMock).toHaveBeenNthCalledWith(2, 'vercel', ['--prod'], 'vercel --prod', '/repo/my-app')
    expect(logStepMock).toHaveBeenCalledWith('Vercel 배포')
    expect(logMessageMock).toHaveBeenCalledWith('Vercel 배포 완료: my-app')
  })

  it('uses VERCEL_TOKEN before the Vercel CLI auth file', async () => {
    process.env.VERCEL_TOKEN = 'env-token'
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await deployVercelProject('/repo/my-app', 'my-app', 'bichikim/my-app')

    expect(readFileMock).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.vercel.com/v11/projects',
      expect.objectContaining({
        headers: expect.objectContaining({Authorization: 'Bearer env-token'}),
      }),
    )
  })

  it('throws the Vercel API error message when project creation fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({error: {message: 'GitHub integration is not installed'}}),
    })
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await expect(deployVercelProject('/repo/my-app', 'my-app', 'bichikim/my-app')).rejects.toThrow(
      'GitHub integration is not installed',
    )
    expect(runCommandMock).not.toHaveBeenCalled()
  })
})
