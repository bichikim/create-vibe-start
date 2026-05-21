import {RPCHandler} from '@orpc/server/fetch'
import {defineEventHandler, setResponseStatus} from 'h3'
import {auth} from '../../auth'
import {appRouter} from '../../rpc/router'

const notFoundStatus = 404
const handler = new RPCHandler(appRouter)

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({
    headers: event.headers,
  })

  const {matched, response} = await handler.handle(event.req, {
    prefix: '/rpc',
    context: {session},
  })

  if (matched) {
    return response
  }

  setResponseStatus(event, notFoundStatus)
  return {error: 'Not found'}
})
