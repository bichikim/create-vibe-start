import {describe, expect, it} from 'vitest'
import {createVercelFetchStub} from '../helpers/vercel-api-stub'

describe('createVercelFetchStub', () => {
  it('answers project create, env upsert, and deployment list', async () => {
    const fetchStub = createVercelFetchStub({
      projectId: 'prj_123',
      accountId: 'team_123',
      deploymentUrl: 'demo.vercel.app',
    })

    const created = await fetchStub('https://api.vercel.com/v11/projects', {method: 'POST'})
    await expect(created.json()).resolves.toEqual({id: 'prj_123', accountId: 'team_123'})
    expect(created.ok).toBe(true)

    const env = await fetchStub(
      'https://api.vercel.com/v10/projects/prj_123/env?teamId=team_123&upsert=true',
      {method: 'POST'},
    )
    await expect(env.json()).resolves.toEqual({})
    expect(env.ok).toBe(true)

    const deployments = await fetchStub(
      'https://api.vercel.com/v13/deployments?projectId=prj_123&target=production&limit=20&teamId=team_123',
    )
    await expect(deployments.json()).resolves.toEqual({
      deployments: [{state: 'READY', target: 'production', url: 'demo.vercel.app'}],
    })
  })

  it('fails explicitly for unmatched URLs', async () => {
    const fetchStub = createVercelFetchStub()

    await expect(fetchStub('https://api.vercel.com/v1/unknown')).rejects.toThrow(
      'vercel-api-stub: unmatched request GET https://api.vercel.com/v1/unknown',
    )
  })
})
