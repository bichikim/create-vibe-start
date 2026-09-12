export type VercelFetchStubOptions = {
  projectId?: string
  accountId?: string
  deploymentUrl?: string
}

type FetchInput = string | URL | {url: string}

type FetchInit = {
  method?: string
}

type StubResponse = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

/**
 * Create a fetch implementation that answers the Vercel REST calls used by deploy steps.
 */
export function createVercelFetchStub(options: VercelFetchStubOptions = {}) {
  const projectId = options.projectId ?? 'prj_mock'
  const accountId = options.accountId ?? 'team_mock'
  const deploymentUrl = options.deploymentUrl ?? 'mock-project.vercel.app'

  return async (input: FetchInput, init?: FetchInit): Promise<StubResponse> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const method = (init?.method ?? 'GET').toUpperCase()

    if (method === 'POST' && url === 'https://api.vercel.com/v11/projects') {
      return jsonResponse({id: projectId, accountId})
    }

    if (method === 'POST' && url.includes('/env?')) {
      return jsonResponse({})
    }

    if (method === 'GET' && url.startsWith('https://api.vercel.com/v13/deployments')) {
      return jsonResponse({
        deployments: [
          {
            state: 'READY',
            target: 'production',
            url: deploymentUrl,
          },
        ],
      })
    }

    throw new Error(`vercel-api-stub: unmatched request ${method} ${url}`)
  }
}

function jsonResponse(body: unknown, status = 200): StubResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}
