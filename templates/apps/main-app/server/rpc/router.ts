import {desc} from 'drizzle-orm'
import {os} from '@orpc/server'
import {z} from 'zod'
import {auth} from '../auth'
import {db, ensureDatabase} from '../db/client'
import {notes} from '../db/schema'
import {env} from '../env'
import {stripeClient, stripePriceId} from '../lib/stripe'

type RpcContext = {
  session: Awaited<ReturnType<typeof auth.api.getSession>>
}

const noteTextMaxLength = 240
const unauthorizedMessage = 'Unauthorized'

const NoteSchema = z.object({
  id: z.number().int(),
  text: z.string(),
  createdAt: z.string(),
})

const CreateNoteSchema = z.object({
  text: z.string().trim().min(1).max(noteTextMaxLength),
})

const CheckoutSessionSchema = z.object({
  url: z.string().url(),
})

function requireSession(context: unknown) {
  const {session} = context as RpcContext
  if (!session) {
    throw new Error(unauthorizedMessage)
  }

  return session
}

export const appRouter = {
  billing: {
    createCheckoutSession: os.output(CheckoutSessionSchema).handler(async ({context}) => {
      const session = requireSession(context)
      const checkout = await stripeClient().checkout.sessions.create({
        mode: 'payment',
        ['line_items']: [{price: stripePriceId(), quantity: 1}],
        ['customer_email']: session.user.email,
        ['shipping_address_collection']: {
          ['allowed_countries']: ['KR'],
        },
        ['success_url']: `${env.BETTER_AUTH_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        ['cancel_url']: `${env.BETTER_AUTH_URL}/billing/cancel`,
      })

      if (!checkout.url) {
        throw new Error('Stripe did not return a checkout URL.')
      }

      return {url: checkout.url}
    }),
  },
  notes: {
    list: os.output(z.array(NoteSchema)).handler(async () => {
      await ensureDatabase()
      return db.select().from(notes).orderBy(desc(notes.createdAt))
    }),
    create: os.input(CreateNoteSchema).output(NoteSchema).handler(async ({input, context}) => {
      requireSession(context)

      await ensureDatabase()
      const [note] = await db.insert(notes).values({text: input.text}).returning()
      return note
    }),
  },
}
