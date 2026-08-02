import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const readFileMock = vi.hoisted(() => vi.fn())

vi.mock('node:fs/promises', () => ({readFile: readFileMock}))
vi.mock('../../utils/user-directories', () => ({userDataDirectory: () => '/user-data'}))

describe('Vercel API', () => {
  const originalToken = process.env.VERCEL_TOKEN
  const fetchMock = vi.fn()

  beforeEach(() => {
    process.env.VERCEL_TOKEN = 'test-token'
    readFileMock.mockReset()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.VERCEL_TOKEN
    } else {
      process.env.VERCEL_TOKEN = originalToken
    }
    vi.unstubAllGlobals()
  })

  it('returns a ready production deployment from a valid response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          deployments: [{state: 'READY', target: 'production', url: 'my-app.vercel.app'}],
        }),
    })
    const {findProductionDeployment} = await import('../vercel-api')

    await expect(findProductionDeployment({id: 'project-id', accountId: 'team-id'})).resolves.toEqual({
      ready: true,
      url: 'https://my-app.vercel.app/',
    })
  })

  it('rejects a malformed successful deployment response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({deployments: 'invalid'}),
    })
    const {findProductionDeployment} = await import('../vercel-api')

    await expect(findProductionDeployment({id: 'project-id', accountId: 'team-id'})).rejects.toThrow(
      'Vercel deployment 응답이 올바르지 않습니다.',
    )
  })

  it('preserves the JSON error from a malformed successful deployment response', async () => {
    const parseError = new Error('invalid JSON')
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(parseError),
    })
    const {findProductionDeployment} = await import('../vercel-api')

    const error = await findProductionDeployment({id: 'project-id', accountId: 'team-id'}).catch(
      (caught: unknown) => caught,
    )
    expect(error).toMatchObject({
      message: 'Vercel deployment 응답이 올바른 JSON이 아닙니다.',
      cause: parseError,
    })
  })

  it('returns a validated project from the create response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({id: 'project-id', accountId: 'team-id'}),
    })
    const {createVercelProject} = await import('../vercel-api')

    await expect(createVercelProject('my-app', 'owner/my-app')).resolves.toEqual({
      id: 'project-id',
      accountId: 'team-id',
    })
  })

  it('rejects a malformed successful project response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({id: 'project-id'}),
    })
    const {createVercelProject} = await import('../vercel-api')

    await expect(createVercelProject('my-app', 'owner/my-app')).rejects.toThrow('Vercel 프로젝트 생성에 실패했습니다.')
  })

  it('preserves the JSON error from a malformed successful project response', async () => {
    const parseError = new Error('invalid JSON')
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.reject(parseError),
    })
    const {createVercelProject} = await import('../vercel-api')

    const error = await createVercelProject('my-app', 'owner/my-app').catch((caught: unknown) => caught)
    expect(error).toMatchObject({
      message: 'Vercel 프로젝트 생성 응답이 올바른 JSON이 아닙니다.',
      cause: parseError,
    })
  })

  it('rejects empty project identifiers', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({id: '', accountId: 'team-id'}),
    })
    const {createVercelProject} = await import('../vercel-api')

    await expect(createVercelProject('my-app', 'owner/my-app')).rejects.toThrow('Vercel 프로젝트 생성에 실패했습니다.')
  })

  it('uses the API error message when setting the auth secret fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({error: {message: 'permission denied'}}),
    })
    const {setBetterAuthSecret} = await import('../vercel-api')

    await expect(setBetterAuthSecret({id: 'project-id', accountId: 'team-id'})).rejects.toThrow('permission denied')
  })

  it('uses the fallback when the auth secret error response has no message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    })
    const {setBetterAuthSecret} = await import('../vercel-api')

    await expect(setBetterAuthSecret({id: 'project-id', accountId: 'team-id'})).rejects.toThrow(
      'Better Auth 환경 변수 설정에 실패했습니다.',
    )
  })

  it('rejects an invalid auth file with a boundary error', async () => {
    delete process.env.VERCEL_TOKEN
    readFileMock.mockResolvedValue('{invalid')
    const {createVercelProject} = await import('../vercel-api')

    await expect(createVercelProject('my-app', 'owner/my-app')).rejects.toThrow(
      'Vercel API 인증 파일이 올바른 JSON이 아닙니다.',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('translates an auth file read failure and preserves its cause', async () => {
    const readError = new Error('permission denied')
    delete process.env.VERCEL_TOKEN
    readFileMock.mockRejectedValue(readError)
    const {createVercelProject} = await import('../vercel-api')

    const error = await createVercelProject('my-app', 'owner/my-app').catch((caught: unknown) => caught)
    expect(error).toMatchObject({message: 'Vercel API 인증 파일을 읽을 수 없습니다.', cause: readError})
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
