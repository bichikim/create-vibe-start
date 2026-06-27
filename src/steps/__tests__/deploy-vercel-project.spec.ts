import {beforeEach, describe, expect, it, vi} from 'vitest'

const accessMock = vi.fn()
const mkdirMock = vi.fn()
const readFileMock = vi.fn()
const rmMock = vi.fn()
const writeFileMock = vi.fn()
const runCommandMock = vi.fn()
const logStepMock = vi.fn()
const logMessageMock = vi.fn()
const logWarnMock = vi.fn()
const fetchMock = vi.fn()
const execaMock = vi.fn()

vi.mock('execa', () => ({
  execa: execaMock,
}))

vi.mock('node:fs/promises', () => ({
  access: accessMock,
  mkdir: mkdirMock,
  readFile: readFileMock,
  rm: rmMock,
  writeFile: writeFileMock,
}))

vi.mock('../../utils/run-command.js', () => ({
  runCommand: runCommandMock,
}))

vi.mock('@clack/prompts', () => ({
  log: {
    info: vi.fn(),
    step: logStepMock,
    message: logMessageMock,
    warn: logWarnMock,
  },
}))

describe('deployVercelProject', () => {
  const originalPlatform = process.platform
  const originalAppData = process.env.APPDATA
  const originalXdgDataHome = process.env.XDG_DATA_HOME

  function missingVercelProjectLink() {
    return Object.assign(new Error('missing'), {code: 'ENOENT'})
  }

  function missingMobileEnvFile() {
    return Object.assign(new Error('missing'), {code: 'ENOENT'})
  }

  function restoreEnvVar(name: 'APPDATA' | 'XDG_DATA_HOME', value: string | undefined) {
    if (value === undefined) {
      delete process.env[name]
      return
    }
    process.env[name] = value
  }

  beforeEach(() => {
    Object.defineProperty(process, 'platform', {value: originalPlatform, configurable: true})
    restoreEnvVar('APPDATA', originalAppData)
    restoreEnvVar('XDG_DATA_HOME', originalXdgDataHome)
    fetchMock.mockReset()
    fetchMock.mockImplementation(async (url: string) => {
      if (url === 'https://api.vercel.com/v11/projects') {
        return {
          ok: true,
          json: () => Promise.resolve({id: 'prj_123', accountId: 'team_123'}),
        }
      }
      if (url.includes('/env?')) {
        return {
          ok: true,
          json: () => Promise.resolve({}),
        }
      }
      if (url.startsWith('https://api.vercel.com/v13/deployments')) {
        return {
          ok: true,
          json: () => Promise.resolve({deployments: []}),
        }
      }

      return {
        ok: true,
        json: () => Promise.resolve({}),
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    accessMock.mockReset().mockResolvedValue(undefined)
    execaMock.mockReset().mockResolvedValue(undefined)
    mkdirMock.mockReset().mockResolvedValue(undefined)
    rmMock.mockReset().mockResolvedValue(undefined)
    readFileMock.mockReset()
    readFileMock.mockImplementation(async (path: string) => {
      if (String(path).endsWith('.vercel/project.json')) {
        throw missingVercelProjectLink()
      }
      if (String(path).endsWith('.env.migrate.local')) {
        return 'TURSO_DATABASE_URL=libsql://test.turso.io\nTURSO_AUTH_TOKEN=turso-token\n'
      }
      if (String(path).includes('auth.json')) {
        return '{"token":"file-token"}'
      }
      return ''
    })
    writeFileMock.mockReset().mockResolvedValue(undefined)
    runCommandMock.mockReset().mockResolvedValue(undefined)
    logStepMock.mockReset()
    logMessageMock.mockReset()
    logWarnMock.mockReset()
    delete process.env.VERCEL_TOKEN
  })

  it('creates a Git-connected Vercel project, writes local link metadata, and deploys to production', async () => {
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await deployVercelProject('/repo/my-app', 'my-app', {githubRepository: 'bichikim/my-app'})

    expect(accessMock).toHaveBeenCalledWith('/repo/my-app/apps/main-app/package.json')
    expect(fetchMock).toHaveBeenCalledWith('https://api.vercel.com/v11/projects', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer file-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        framework: 'vite',
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
    expect(writeFileMock).toHaveBeenCalledWith(
      '/repo/my-app/apps/main-app/.env.mobile',
      'VITE_API_URL=https://my-app.vercel.app\n',
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
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.vercel.com/v10/projects/prj_123/env?teamId=team_123&upsert=true',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer file-token',
          'Content-Type': 'application/json',
        },
        body: expect.stringMatching(/"BETTER_AUTH_SECRET"/),
      },
    )
    const envBody = JSON.parse(
      (fetchMock.mock.calls.find(([url]) => String(url).includes('/env?'))?.[1] as {body: string}).body,
    ) as Array<{key: string; value: string; type: string; target: string[]}>
    expect(envBody).toEqual([
      {
        key: 'BETTER_AUTH_SECRET',
        value: expect.stringMatching(/^[A-Za-z0-9+/]+=*$/),
        type: 'sensitive',
        target: ['production'],
      },
    ])
    expect(runCommandMock).toHaveBeenNthCalledWith(
      2,
      'vercel',
      [
        'env',
        'pull',
        '/repo/my-app/apps/main-app/.env.migrate.local',
        '--environment',
        'production',
        '--yes',
      ],
      'vercel env pull',
      '/repo/my-app',
    )
    expect(rmMock).toHaveBeenCalledWith('/repo/my-app/apps/main-app/.env.migrate.local', {force: true})
    expect(execaMock).toHaveBeenCalledWith('pnpm', ['db:migrate'], {
      cwd: '/repo/my-app/apps/main-app',
      stdio: 'inherit',
      env: expect.objectContaining({
        TURSO_DATABASE_URL: 'libsql://test.turso.io',
        TURSO_AUTH_TOKEN: 'turso-token',
      }),
    })
    expect(runCommandMock).toHaveBeenNthCalledWith(3, 'vercel', ['--prod'], 'vercel --prod', '/repo/my-app')
    expect(logStepMock).toHaveBeenCalledWith('Vercel 배포')
    expect(logMessageMock).toHaveBeenCalledWith('Vercel 배포 완료: my-app')
    expect(logMessageMock).toHaveBeenCalledWith(
      'Better Auth URL은 Vercel 시스템 변수(VERCEL_URL)로 런타임에 결정됩니다.',
    )
  })

  it('rejects a directory that is not a generated project root before external setup', async () => {
    accessMock.mockRejectedValue(new Error('missing'))
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await expect(
      deployVercelProject('/repo/wrong-dir', 'my-app', {githubRepository: 'bichikim/my-app'}),
    ).rejects.toThrow(
      '생성된 프로젝트 루트가 아닙니다. --dir에는 create-vibe-start 프로젝트 루트를 지정해주세요.',
    )

    expect(fetchMock).not.toHaveBeenCalled()
    expect(runCommandMock).not.toHaveBeenCalled()
    expect(execaMock).not.toHaveBeenCalled()
    expect(logStepMock).not.toHaveBeenCalled()
  })

  it('creates the mobile env file after production deploy when it is missing', async () => {
    readFileMock.mockImplementation(async (path: string) => {
      if (String(path).endsWith('.vercel/project.json')) {
        throw missingVercelProjectLink()
      }
      if (String(path).endsWith('.env.migrate.local')) {
        return 'TURSO_DATABASE_URL=libsql://test.turso.io\nTURSO_AUTH_TOKEN=turso-token\n'
      }
      if (String(path).endsWith('.env.mobile')) {
        throw missingMobileEnvFile()
      }
      if (String(path).includes('auth.json')) {
        return '{"token":"file-token"}'
      }
      return ''
    })
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await deployVercelProject('/repo/my-app', 'my-app', {githubRepository: 'bichikim/my-app'})

    expect(writeFileMock).toHaveBeenCalledWith(
      '/repo/my-app/apps/main-app/.env.mobile',
      'VITE_API_URL=https://my-app.vercel.app\n',
    )
    expect(logMessageMock).toHaveBeenCalledWith(
      '모바일 API URL을 apps/main-app/.env.mobile에 설정했습니다: https://my-app.vercel.app',
    )
  })

  it('appends the mobile API URL when the mobile env file has no existing value', async () => {
    readFileMock.mockImplementation(async (path: string) => {
      if (String(path).endsWith('.vercel/project.json')) {
        throw missingVercelProjectLink()
      }
      if (String(path).endsWith('.env.migrate.local')) {
        return 'TURSO_DATABASE_URL=libsql://test.turso.io\nTURSO_AUTH_TOKEN=turso-token\n'
      }
      if (String(path).endsWith('.env.mobile')) {
        return 'EXISTING=value'
      }
      if (String(path).includes('auth.json')) {
        return '{"token":"file-token"}'
      }
      return ''
    })
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await deployVercelProject('/repo/my-app', 'my-app', {githubRepository: 'bichikim/my-app'})

    expect(writeFileMock).toHaveBeenCalledWith(
      '/repo/my-app/apps/main-app/.env.mobile',
      'EXISTING=value\nVITE_API_URL=https://my-app.vercel.app\n',
    )
  })

  it('keeps an existing mobile API URL unchanged', async () => {
    readFileMock.mockImplementation(async (path: string) => {
      if (String(path).endsWith('.vercel/project.json')) {
        throw missingVercelProjectLink()
      }
      if (String(path).endsWith('.env.migrate.local')) {
        return 'TURSO_DATABASE_URL=libsql://test.turso.io\nTURSO_AUTH_TOKEN=turso-token\n'
      }
      if (String(path).endsWith('.env.mobile')) {
        return 'VITE_API_URL=https://api.example.com\n'
      }
      if (String(path).includes('auth.json')) {
        return '{"token":"file-token"}'
      }
      return ''
    })
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await deployVercelProject('/repo/my-app', 'my-app', {githubRepository: 'bichikim/my-app'})

    expect(writeFileMock).not.toHaveBeenCalledWith(
      '/repo/my-app/apps/main-app/.env.mobile',
      expect.anything(),
    )
    expect(logMessageMock).toHaveBeenCalledWith('기존 모바일 API URL을 유지합니다.')
  })

  it('throws unexpected mobile env read errors', async () => {
    readFileMock.mockImplementation(async (path: string) => {
      if (String(path).endsWith('.vercel/project.json')) {
        throw missingVercelProjectLink()
      }
      if (String(path).endsWith('.env.migrate.local')) {
        return 'TURSO_DATABASE_URL=libsql://test.turso.io\nTURSO_AUTH_TOKEN=turso-token\n'
      }
      if (String(path).endsWith('.env.mobile')) {
        throw Object.assign(new Error('permission denied'), {code: 'EACCES'})
      }
      if (String(path).includes('auth.json')) {
        return '{"token":"file-token"}'
      }
      return ''
    })
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await expect(deployVercelProject('/repo/my-app', 'my-app', {githubRepository: 'bichikim/my-app'})).rejects.toThrow(
      'permission denied',
    )

    expect(writeFileMock).not.toHaveBeenCalledWith(
      '/repo/my-app/apps/main-app/.env.mobile',
      expect.anything(),
    )
  })

  it('skips completed repair work for an existing successful Vercel project', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.startsWith('https://api.vercel.com/v13/deployments')) {
        return {
          ok: true,
          json: () => Promise.resolve({deployments: [{state: 'READY', target: 'production'}]}),
        }
      }

      return {
        ok: true,
        json: () => Promise.resolve({}),
      }
    })
    readFileMock.mockImplementation(async (path: string) => {
      if (String(path).endsWith('.vercel/project.json')) {
        return '{"orgId":"team_linked","projectId":"prj_linked"}'
      }
      if (String(path).endsWith('.env.migrate.local')) {
        return [
          'TURSO_DATABASE_URL=libsql://test.turso.io',
          'TURSO_AUTH_TOKEN=turso-token',
          'BETTER_AUTH_SECRET=existing-secret',
        ].join('\n')
      }
      if (String(path).endsWith('.env.mobile')) {
        return 'VITE_API_URL=https://api.example.com\n'
      }
      if (String(path).includes('auth.json')) {
        return '{"token":"file-token"}'
      }
      return ''
    })
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await deployVercelProject('/repo/my-app', 'my-app')

    expect(fetchMock).not.toHaveBeenCalledWith('https://api.vercel.com/v11/projects', expect.anything())
    expect(fetchMock).not.toHaveBeenCalledWith(
      'https://api.vercel.com/v10/projects/prj_linked/env?teamId=team_linked&upsert=true',
      expect.anything(),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://api.vercel.com/v13/deployments'),
      expect.objectContaining({
        headers: expect.objectContaining({Authorization: 'Bearer file-token'}),
      }),
    )
    expect(runCommandMock).toHaveBeenCalledTimes(1)
    expect(execaMock).not.toHaveBeenCalled()
    expect(runCommandMock).not.toHaveBeenCalledWith('vercel', ['--prod'], 'vercel --prod', '/repo/my-app')
    expect(logMessageMock).toHaveBeenCalledWith('기존 Vercel 프로젝트 링크를 재사용합니다.')
    expect(logMessageMock).toHaveBeenCalledWith('기존 Turso production 환경 변수를 재사용합니다.')
    expect(logMessageMock).toHaveBeenCalledWith('기존 Better Auth production secret을 재사용합니다.')
    expect(logMessageMock).toHaveBeenCalledWith('Vercel repair 완료: my-app은 이미 설정되어 있습니다.')
  })

  it('reuses an existing Vercel project link and Turso env without rotating an existing secret', async () => {
    readFileMock.mockImplementation(async (path: string) => {
      if (String(path).endsWith('.vercel/project.json')) {
        return '{"orgId":"team_linked","projectId":"prj_linked"}'
      }
      if (String(path).endsWith('.env.migrate.local')) {
        return [
          'TURSO_DATABASE_URL=libsql://test.turso.io',
          'TURSO_AUTH_TOKEN=turso-token',
          'BETTER_AUTH_SECRET=existing-secret',
        ].join('\n')
      }
      if (String(path).includes('auth.json')) {
        return '{"token":"file-token"}'
      }
      return ''
    })
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await deployVercelProject('/repo/my-app', 'my-app')

    expect(fetchMock).not.toHaveBeenCalledWith('https://api.vercel.com/v11/projects', expect.anything())
    expect(mkdirMock).not.toHaveBeenCalled()
    expect(writeFileMock).not.toHaveBeenCalledWith(
      '/repo/my-app/.vercel/project.json',
      expect.anything(),
    )
    expect(fetchMock).not.toHaveBeenCalledWith(
      'https://api.vercel.com/v10/projects/prj_linked/env?teamId=team_linked&upsert=true',
      expect.anything(),
    )
    expect(runCommandMock).toHaveBeenNthCalledWith(
      1,
      'vercel',
      [
        'env',
        'pull',
        '/repo/my-app/apps/main-app/.env.migrate.local',
        '--environment',
        'production',
        '--yes',
      ],
      'vercel env pull',
      '/repo/my-app',
    )
    expect(runCommandMock).toHaveBeenNthCalledWith(2, 'vercel', ['--prod'], 'vercel --prod', '/repo/my-app')
    expect(runCommandMock).not.toHaveBeenCalledWith(
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
    expect(logMessageMock).toHaveBeenCalledWith('기존 Vercel 프로젝트 링크를 재사용합니다.')
    expect(logMessageMock).toHaveBeenCalledWith('기존 Turso production 환경 변수를 재사용합니다.')
    expect(logMessageMock).toHaveBeenCalledWith('기존 Better Auth production secret을 재사용합니다.')
  })

  it('throws a clear message when checking production deployments fails', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.startsWith('https://api.vercel.com/v13/deployments')) {
        return {
          ok: false,
          json: () => Promise.resolve({error: {message: 'deployment denied'}}),
        }
      }

      return {
        ok: true,
        json: () => Promise.resolve({}),
      }
    })
    readFileMock.mockImplementation(async (path: string) => {
      if (String(path).endsWith('.vercel/project.json')) {
        return '{"orgId":"team_linked","projectId":"prj_linked"}'
      }
      if (String(path).endsWith('.env.migrate.local')) {
        return [
          'TURSO_DATABASE_URL=libsql://test.turso.io',
          'TURSO_AUTH_TOKEN=turso-token',
          'BETTER_AUTH_SECRET=existing-secret',
        ].join('\n')
      }
      if (String(path).includes('auth.json')) {
        return '{"token":"file-token"}'
      }
      return ''
    })
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await expect(deployVercelProject('/repo/my-app', 'my-app')).rejects.toThrow('deployment denied')

    expect(execaMock).not.toHaveBeenCalled()
    expect(runCommandMock).not.toHaveBeenCalledWith('vercel', ['--prod'], 'vercel --prod', '/repo/my-app')
  })

  it('uses the fallback message when checking production deployments returns invalid JSON', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.startsWith('https://api.vercel.com/v13/deployments')) {
        return {
          ok: false,
          json: () => Promise.reject(new Error('invalid json')),
        }
      }

      return {
        ok: true,
        json: () => Promise.resolve({}),
      }
    })
    readFileMock.mockImplementation(async (path: string) => {
      if (String(path).endsWith('.vercel/project.json')) {
        return '{"orgId":"team_linked","projectId":"prj_linked"}'
      }
      if (String(path).endsWith('.env.migrate.local')) {
        return [
          'TURSO_DATABASE_URL=libsql://test.turso.io',
          'TURSO_AUTH_TOKEN=turso-token',
          'BETTER_AUTH_SECRET=existing-secret',
        ].join('\n')
      }
      if (String(path).includes('auth.json')) {
        return '{"token":"file-token"}'
      }
      return ''
    })
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await expect(deployVercelProject('/repo/my-app', 'my-app')).rejects.toThrow(
      'Vercel deployment 상태 확인에 실패했습니다.',
    )

    expect(execaMock).not.toHaveBeenCalled()
    expect(runCommandMock).not.toHaveBeenCalledWith('vercel', ['--prod'], 'vercel --prod', '/repo/my-app')
  })

  it('adds Turso integration for an existing Vercel link when production env is missing', async () => {
    let envReads = 0
    readFileMock.mockImplementation(async (path: string) => {
      if (String(path).endsWith('.vercel/project.json')) {
        return '{"orgId":"team_linked","projectId":"prj_linked"}'
      }
      if (String(path).endsWith('.env.migrate.local')) {
        envReads += 1
        return envReads === 1
          ? 'TURSO_AUTH_TOKEN=turso-token\n'
          : 'TURSO_DATABASE_URL=libsql://test.turso.io\nTURSO_AUTH_TOKEN=turso-token\n'
      }
      if (String(path).includes('auth.json')) {
        return '{"token":"file-token"}'
      }
      return ''
    })
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await deployVercelProject('/repo/my-app', 'my-app')

    expect(runCommandMock).toHaveBeenNthCalledWith(
      1,
      'vercel',
      [
        'env',
        'pull',
        '/repo/my-app/apps/main-app/.env.migrate.local',
        '--environment',
        'production',
        '--yes',
      ],
      'vercel env pull',
      '/repo/my-app',
    )
    expect(runCommandMock).toHaveBeenNthCalledWith(
      2,
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
    expect(runCommandMock).toHaveBeenNthCalledWith(
      3,
      'vercel',
      [
        'env',
        'pull',
        '/repo/my-app/apps/main-app/.env.migrate.local',
        '--environment',
        'production',
        '--yes',
      ],
      'vercel env pull',
      '/repo/my-app',
    )
    expect(runCommandMock).toHaveBeenNthCalledWith(4, 'vercel', ['--prod'], 'vercel --prod', '/repo/my-app')
  })

  it('warns and reuses an existing Vercel link when a GitHub repository is also provided', async () => {
    readFileMock.mockImplementation(async (path: string) => {
      if (String(path).endsWith('.vercel/project.json')) {
        return '{"orgId":"team_linked","projectId":"prj_linked"}'
      }
      if (String(path).endsWith('.env.migrate.local')) {
        return 'TURSO_DATABASE_URL=libsql://test.turso.io\nTURSO_AUTH_TOKEN=turso-token\n'
      }
      if (String(path).includes('auth.json')) {
        return '{"token":"file-token"}'
      }
      return ''
    })
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await deployVercelProject('/repo/my-app', 'my-app', {githubRepository: 'bichikim/my-app'})

    expect(fetchMock).not.toHaveBeenCalledWith('https://api.vercel.com/v11/projects', expect.anything())
    expect(mkdirMock).not.toHaveBeenCalled()
    expect(writeFileMock).not.toHaveBeenCalledWith(
      '/repo/my-app/.vercel/project.json',
      expect.anything(),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.vercel.com/v10/projects/prj_linked/env?teamId=team_linked&upsert=true',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({Authorization: 'Bearer file-token'}),
      }),
    )
    expect(logWarnMock).toHaveBeenCalledWith(
      '기존 Vercel 프로젝트 링크를 재사용하므로 --github-repository 옵션은 무시합니다.',
    )
  })

  it('requires a GitHub repository when no Vercel project link exists', async () => {
    readFileMock.mockImplementation(async (path: string) => {
      if (String(path).endsWith('.vercel/project.json')) {
        throw missingVercelProjectLink()
      }
      return ''
    })
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await expect(deployVercelProject('/repo/my-app', 'my-app')).rejects.toThrow(
      '기존 Vercel 링크가 없으면 --github-repository owner/name 이 필요합니다.',
    )
    expect(fetchMock).not.toHaveBeenCalled()
    expect(runCommandMock).not.toHaveBeenCalled()
  })

  it('throws when the existing Vercel project link is invalid', async () => {
    readFileMock.mockImplementation(async (path: string) => {
      if (String(path).endsWith('.vercel/project.json')) {
        return '{"projectId":"prj_linked"}'
      }
      return ''
    })
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await expect(deployVercelProject('/repo/my-app', 'my-app')).rejects.toThrow(
      'Vercel 프로젝트 링크 파일이 올바르지 않습니다.',
    )
    expect(fetchMock).not.toHaveBeenCalled()
    expect(runCommandMock).not.toHaveBeenCalled()
  })

  it('uses VERCEL_TOKEN before the Vercel CLI auth file', async () => {
    process.env.VERCEL_TOKEN = 'env-token'
    fetchMock.mockReset()
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({id: 'prj_123', accountId: 'team_123'}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
    })
    readFileMock.mockImplementation(async (path: string) => {
      if (String(path).endsWith('.vercel/project.json')) {
        throw missingVercelProjectLink()
      }
      if (String(path).endsWith('.env.migrate.local')) {
        return 'TURSO_DATABASE_URL=libsql://test.turso.io\n'
      }
      if (String(path).endsWith('.env.mobile')) {
        return ''
      }
      throw new Error('unexpected read')
    })
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await deployVercelProject('/repo/my-app', 'my-app', {githubRepository: 'bichikim/my-app'})

    expect(readFileMock).not.toHaveBeenCalledWith(
      expect.stringContaining('auth.json'),
      'utf8',
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.vercel.com/v11/projects',
      expect.objectContaining({
        headers: expect.objectContaining({Authorization: 'Bearer env-token'}),
      }),
    )
  })

  it('parses quoted Turso env values and ignores unrelated env lines', async () => {
    readFileMock.mockImplementation(async (path: string) => {
      if (String(path).endsWith('.vercel/project.json')) {
        throw missingVercelProjectLink()
      }
      if (String(path).endsWith('.env.migrate.local')) {
        return [
          '# comment',
          'IGNORED=value',
          'TURSO_DATABASE_URL="libsql://quoted.turso.io"',
          "TURSO_AUTH_TOKEN='quoted-token'",
          'BROKEN_LINE',
        ].join('\n')
      }
      if (String(path).includes('auth.json')) {
        return '{"token":"file-token"}'
      }
      return ''
    })
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await deployVercelProject('/repo/my-app', 'my-app', {githubRepository: 'bichikim/my-app'})

    expect(execaMock).toHaveBeenCalledWith('pnpm', ['db:migrate'], {
      cwd: '/repo/my-app/apps/main-app',
      stdio: 'inherit',
      env: expect.objectContaining({
        TURSO_DATABASE_URL: 'libsql://quoted.turso.io',
        TURSO_AUTH_TOKEN: 'quoted-token',
      }),
    })
  })

  it('throws the Vercel API error message when Better Auth env setup fails', async () => {
    fetchMock.mockReset()
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({id: 'prj_123', accountId: 'team_123'}),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({error: {message: 'Not authorized'}}),
    })
    readFileMock.mockImplementation(async (path: string) => {
      if (String(path).endsWith('.vercel/project.json')) {
        throw missingVercelProjectLink()
      }
      if (String(path).includes('auth.json')) {
        return '{"token":"file-token"}'
      }
      return ''
    })
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await expect(deployVercelProject('/repo/my-app', 'my-app', {githubRepository: 'bichikim/my-app'})).rejects.toThrow(
      'Not authorized',
    )
    expect(runCommandMock).toHaveBeenCalledTimes(2)
    expect(runCommandMock).not.toHaveBeenCalledWith('vercel', ['--prod'], 'vercel --prod', '/repo/my-app')
  })

  it('uses the fallback message when Better Auth env setup returns invalid JSON', async () => {
    fetchMock.mockReset()
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({id: 'prj_123', accountId: 'team_123'}),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.reject(new Error('invalid json')),
      })
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await expect(deployVercelProject('/repo/my-app', 'my-app', {githubRepository: 'bichikim/my-app'})).rejects.toThrow(
      'Better Auth 환경 변수 설정에 실패했습니다.',
    )
  })

  it('throws the Vercel API error message when project creation fails', async () => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({error: {message: 'GitHub integration is not installed'}}),
    })
    readFileMock.mockImplementation(async (path: string) => {
      if (String(path).endsWith('.vercel/project.json')) {
        throw missingVercelProjectLink()
      }
      if (String(path).includes('auth.json')) {
        return '{"token":"file-token"}'
      }
      return ''
    })
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await expect(deployVercelProject('/repo/my-app', 'my-app', {githubRepository: 'bichikim/my-app'})).rejects.toThrow(
      'GitHub integration is not installed',
    )
    expect(runCommandMock).not.toHaveBeenCalled()
  })

  it('uses the fallback message when project creation returns invalid JSON', async () => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error('invalid json')),
    })
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await expect(deployVercelProject('/repo/my-app', 'my-app', {githubRepository: 'bichikim/my-app'})).rejects.toThrow(
      'Vercel 프로젝트 생성에 실패했습니다.',
    )
    expect(runCommandMock).not.toHaveBeenCalled()
  })

  it('throws when the pulled production env is missing TURSO_DATABASE_URL', async () => {
    readFileMock.mockImplementation(async (path: string) => {
      if (String(path).endsWith('.vercel/project.json')) {
        throw missingVercelProjectLink()
      }
      if (String(path).endsWith('.env.migrate.local')) {
        return 'TURSO_AUTH_TOKEN=turso-token\n'
      }
      if (String(path).includes('auth.json')) {
        return '{"token":"file-token"}'
      }
      return ''
    })
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await expect(deployVercelProject('/repo/my-app', 'my-app', {githubRepository: 'bichikim/my-app'})).rejects.toThrow(
      'TURSO_DATABASE_URL을 찾을 수 없습니다. Turso 연동 후 다시 시도해주세요.',
    )

    expect(rmMock).toHaveBeenCalledWith('/repo/my-app/apps/main-app/.env.migrate.local', {force: true})
    expect(runCommandMock).toHaveBeenNthCalledWith(
      2,
      'vercel',
      [
        'env',
        'pull',
        '/repo/my-app/apps/main-app/.env.migrate.local',
        '--environment',
        'production',
        '--yes',
      ],
      'vercel env pull',
      '/repo/my-app',
    )
    expect(execaMock).not.toHaveBeenCalled()
    expect(runCommandMock).not.toHaveBeenCalledWith('vercel', ['--prod'], 'vercel --prod', '/repo/my-app')
  })

  it('throws a clear message when the Vercel auth file has no token', async () => {
    readFileMock.mockImplementation(async (path: string) => {
      if (String(path).endsWith('.vercel/project.json')) {
        throw missingVercelProjectLink()
      }
      if (String(path).includes('auth.json')) {
        return '{}'
      }
      return ''
    })
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await expect(deployVercelProject('/repo/my-app', 'my-app', {githubRepository: 'bichikim/my-app'})).rejects.toThrow(
      'Vercel API 토큰을 찾을 수 없습니다. Vercel CLI에 다시 로그인해주세요.',
    )

    expect(fetchMock).not.toHaveBeenCalled()
    expect(runCommandMock).not.toHaveBeenCalled()
  })

  it('reads the Vercel token from the Windows CLI auth path on win32', async () => {
    Object.defineProperty(process, 'platform', {value: 'win32', configurable: true})
    process.env.APPDATA = 'C:\\Users\\me\\AppData\\Roaming'
    fetchMock.mockReset()
    readFileMock.mockImplementation(async (path: string) => {
      if (String(path).endsWith('.vercel/project.json')) {
        throw missingVercelProjectLink()
      }
      if (String(path).includes('auth.json')) {
        expect(String(path)).toContain('C:\\Users\\me\\AppData\\Roaming')
        return '{"token":"file-token"}'
      }
      return ''
    })
    fetchMock.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({error: {message: 'stop'}}),
    })
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await expect(
      deployVercelProject('/repo/my-app', 'my-app', {githubRepository: 'bichikim/my-app'}),
    ).rejects.toThrow('stop')
  })

  it('reads the Vercel token from the macOS CLI auth path on darwin', async () => {
    Object.defineProperty(process, 'platform', {value: 'darwin', configurable: true})
    fetchMock.mockReset()
    readFileMock.mockImplementation(async (path: string) => {
      if (String(path).endsWith('.vercel/project.json')) {
        throw missingVercelProjectLink()
      }
      if (String(path).includes('auth.json')) {
        expect(String(path)).toContain('Library/Application Support/com.vercel.cli')
        return '{"token":"file-token"}'
      }
      return ''
    })
    fetchMock.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({error: {message: 'stop'}}),
    })
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await expect(
      deployVercelProject('/repo/my-app', 'my-app', {githubRepository: 'bichikim/my-app'}),
    ).rejects.toThrow('stop')
  })

  it('reads the Vercel token from XDG_DATA_HOME on other platforms', async () => {
    Object.defineProperty(process, 'platform', {value: 'linux', configurable: true})
    process.env.XDG_DATA_HOME = '/xdg-data'
    fetchMock.mockReset()
    readFileMock.mockImplementation(async (path: string) => {
      if (String(path).endsWith('.vercel/project.json')) {
        throw missingVercelProjectLink()
      }
      if (String(path).includes('auth.json')) {
        expect(String(path)).toContain('/xdg-data')
        return '{"token":"file-token"}'
      }
      return ''
    })
    fetchMock.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({error: {message: 'stop'}}),
    })
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await expect(
      deployVercelProject('/repo/my-app', 'my-app', {githubRepository: 'bichikim/my-app'}),
    ).rejects.toThrow('stop')
  })

  it('falls back to the home data directory when XDG_DATA_HOME is unset', async () => {
    Object.defineProperty(process, 'platform', {value: 'linux', configurable: true})
    delete process.env.XDG_DATA_HOME
    fetchMock.mockReset()
    readFileMock.mockImplementation(async (path: string) => {
      if (String(path).endsWith('.vercel/project.json')) {
        throw missingVercelProjectLink()
      }
      if (String(path).includes('auth.json')) {
        expect(String(path)).toContain('.local/share/com.vercel.cli')
        return '{"token":"file-token"}'
      }
      return ''
    })
    fetchMock.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({error: {message: 'stop'}}),
    })
    const {deployVercelProject} = await import('../deploy-vercel-project')

    await expect(
      deployVercelProject('/repo/my-app', 'my-app', {githubRepository: 'bichikim/my-app'}),
    ).rejects.toThrow('stop')
  })
})
