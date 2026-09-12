import type {RouterClient} from '@orpc/server'
import {createORPCClient} from '@orpc/client'
import {RPCLink} from '@orpc/client/fetch'
import type {appRouter} from '@server/rpc/router'
import {apiUrl} from './lib/api-url'

const link = new RPCLink({
  url: `${apiUrl}/rpc`,
  fetch: (input, init) => fetch(input, {...init, credentials: 'include'}),
})

export const orpc: RouterClient<typeof appRouter> = createORPCClient(link)
