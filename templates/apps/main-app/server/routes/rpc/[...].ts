import {RPCHandler} from '@orpc/server/fetch'
import {defineEventHandler, setResponseStatus} from 'h3'
import {appRouter} from '../../rpc/router'

const notFoundStatus = 404
const handler = new RPCHandler(appRouter)

export default defineEventHandler(async (event) => {
  const {matched, response} = await handler.handle(event.req, {
    prefix: '/rpc',
    context: {},
  })

  if (matched) {
    return response
  }

  setResponseStatus(event, notFoundStatus)
  return {error: 'Not found'}
})
