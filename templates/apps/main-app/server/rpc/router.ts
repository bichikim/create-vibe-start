import {desc} from 'drizzle-orm'
import {os} from '@orpc/server'
import {z} from 'zod'
import {auth} from '../auth'
import {db, ensureDatabase} from '../db/client'
import {notes} from '../db/schema'

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

export const appRouter = {
  notes: {
    list: os.output(z.array(NoteSchema)).handler(async () => {
      await ensureDatabase()
      return db.select().from(notes).orderBy(desc(notes.createdAt))
    }),
    create: os.input(CreateNoteSchema).output(NoteSchema).handler(async ({input, context}) => {
      if (!(context as RpcContext).session) {
        throw new Error(unauthorizedMessage)
      }

      await ensureDatabase()
      const [note] = await db.insert(notes).values({text: input.text}).returning()
      return note
    }),
  },
}
