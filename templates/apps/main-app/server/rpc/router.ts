import {desc} from 'drizzle-orm'
import {os} from '@orpc/server'
import {z} from 'zod'
import {db, ensureDatabase} from '../db/client'
import {notes} from '../db/schema'

const noteTextMaxLength = 240

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
    create: os.input(CreateNoteSchema).output(NoteSchema).handler(async ({input}) => {
      await ensureDatabase()
      const [note] = await db.insert(notes).values({text: input.text}).returning()
      return note
    }),
  },
}
