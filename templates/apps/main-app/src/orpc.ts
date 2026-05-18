import type {RouterClient} from '@orpc/server'
import {createORPCClient} from '@orpc/client'
import {RPCLink} from '@orpc/client/fetch'
import type {appRouter} from '@server/rpc/router'

const link = new RPCLink({
  url: `${window.location.origin}/rpc`,
})

export const orpc: RouterClient<typeof appRouter> = createORPCClient(link)
