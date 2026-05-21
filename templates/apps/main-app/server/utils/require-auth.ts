import {createError, type EventHandler, type H3Event} from 'h3'
import {auth} from '../auth'

export const requireAuth: EventHandler = async (event: H3Event) => {
  const session = await auth.api.getSession({
    headers: event.headers,
  })

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  event.context.auth = session
}
