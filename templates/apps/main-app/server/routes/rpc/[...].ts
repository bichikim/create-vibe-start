import {RPCHandler} from '@orpc/server/fetch'
import {defineEventHandler, setResponseStatus} from 'h3'
import {auth} from '../../auth'
import {env} from '../../env'
import {appRouter} from '../../rpc/router'

const notFoundStatus = 404
const handler = new RPCHandler(appRouter)
const allowedOrigins = new Set([
  'capacitor://localhost',
  'http://localhost',
  ...env.BETTER_AUTH_TRUSTED_ORIGINS,
])

function corsHeaders(origin: string | null) {
  if (!origin || !allowedOrigins.has(origin)) {
    return {}
  }

  return {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
  }
}

function withCors(response: Response, origin: string | null) {
  const nextResponse = new Response(response.body, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  })
  const headers = corsHeaders(origin)
  for (const [key, value] of Object.entries(headers)) {
    nextResponse.headers.set(key, value)
  }

  return nextResponse
}

export default defineEventHandler(async (event) => {
  const origin = event.headers.get('origin')

  if (event.req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders(origin),
        'Access-Control-Allow-Headers': event.headers.get('access-control-request-headers') ?? 'content-type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
    })
  }

  const session = await auth.api.getSession({
    headers: event.headers,
  })

  const {matched, response} = await handler.handle(event.req, {
    prefix: '/rpc',
    context: {session},
  })

  if (matched) {
    return withCors(response, origin)
  }

  setResponseStatus(event, notFoundStatus)
  return {error: 'Not found'}
})
