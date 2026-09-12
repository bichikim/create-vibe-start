import {afterEach, describe, expect, it, vi} from 'vitest'

function response(value: unknown, status = 200) {
  return new Response(value === undefined ? '' : JSON.stringify(value), {
    status,
    headers: {'Content-Type': 'application/json'},
  })
}

describe('codemagic-api', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('verifies an application', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({application: {_id: 'app-id'}}))
    vi.stubGlobal('fetch', fetchMock)
    const {verifyCodemagicApplication} = await import('../codemagic-api')

    await verifyCodemagicApplication('app/id', 'token')

    expect(fetchMock).toHaveBeenCalledWith('https://api.codemagic.io/apps/app%2Fid', {
      headers: {'Content-Type': 'application/json', 'x-auth-token': 'token'},
    })
  })

  it.each([
    [{_id: 'direct-id'}, 'direct-id'],
    [{application: {_id: 'nested-id'}}, 'nested-id'],
  ])('registers an application from supported API response shapes', async (body, expectedId) => {
    const fetchMock = vi.fn().mockResolvedValue(response(body))
    vi.stubGlobal('fetch', fetchMock)
    const {registerCodemagicApplication} = await import('../codemagic-api')

    await expect(registerCodemagicApplication('git@example/repo.git', 'token')).resolves.toEqual({id: expectedId})
    expect(fetchMock).toHaveBeenCalledWith('https://api.codemagic.io/apps', {
      method: 'POST',
      body: JSON.stringify({repositoryUrl: 'git@example/repo.git'}),
      headers: {'Content-Type': 'application/json', 'x-auth-token': 'token'},
    })
  })

  it('rejects a registration response without an application id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({application: {}})))
    const {registerCodemagicApplication} = await import('../codemagic-api')

    await expect(registerCodemagicApplication('repo', 'token')).rejects.toThrow(
      'Codemagic Application ID를 응답에서 찾을 수 없습니다.',
    )
  })

  it('starts a YAML workflow build', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({buildId: 'build-id'}))
    vi.stubGlobal('fetch', fetchMock)
    const {startCodemagicBuild} = await import('../codemagic-api')

    await expect(
      startCodemagicBuild({
        applicationId: 'app-id',
        branch: 'main',
        token: 'token',
        workflowId: 'ios-release',
      }),
    ).resolves.toBe('build-id')
    expect(fetchMock).toHaveBeenCalledWith('https://api.codemagic.io/builds', {
      method: 'POST',
      body: JSON.stringify({appId: 'app-id', workflowId: 'ios-release', branch: 'main'}),
      headers: {'Content-Type': 'application/json', 'x-auth-token': 'token'},
    })
  })

  it('rejects a build response without a build id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({})))
    const {startCodemagicBuild} = await import('../codemagic-api')

    await expect(
      startCodemagicBuild({applicationId: 'app', branch: 'main', token: 'token', workflowId: 'android-release'}),
    ).rejects.toThrow('Codemagic Build ID를 응답에서 찾을 수 없습니다.')
  })

  it.each([
    [response({message: 'denied'}, 401), 'denied'],
    [response(undefined, 500), 'Codemagic API 요청 실패 (500)'],
  ])('reports Codemagic API errors', async (apiResponse, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(apiResponse))
    const {verifyCodemagicApplication} = await import('../codemagic-api')

    await expect(verifyCodemagicApplication('app', 'token')).rejects.toThrow(message)
  })
})
