import {betterAuth} from 'better-auth'
import {drizzleAdapter} from 'better-auth/adapters/drizzle'
import {db} from './db/client'
import {env} from './env'

const isProduction = process.env.NODE_ENV === 'production'

function staticTrustedOrigins(baseUrl: string, extraOrigins: string[]) {
  const url = new URL(baseUrl)
  const port = url.port ? `:${url.port}` : ''
  const origins = new Set([
    url.origin,
    'capacitor://localhost',
    'http://localhost',
    ...extraOrigins,
  ])

  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    origins.add(`${url.protocol}//localhost${port}`)
    origins.add(`${url.protocol}//127.0.0.1${port}`)
  }

  return [...origins]
}

function originFromHeader(header: string | null) {
  if (!header) {
    return null
  }

  try {
    return new URL(header).origin
  } catch {
    return null
  }
}

function isLocalDevHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

const staticOrigins = staticTrustedOrigins(env.BETTER_AUTH_URL, env.BETTER_AUTH_TRUSTED_ORIGINS)

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: async (request) => {
    if (!request) {
      return staticOrigins
    }

    const origins = new Set(staticOrigins)
    const origin =
      originFromHeader(request.headers.get('origin')) ??
      originFromHeader(request.headers.get('referer'))

    if (!isProduction && origin) {
      const {hostname} = new URL(origin)
      if (isLocalDevHost(hostname)) {
        origins.add(origin)
      }
    }

    return [...origins]
  },
  emailAndPassword: {
    enabled: true,
  },
})
