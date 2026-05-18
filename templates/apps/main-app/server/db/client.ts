import {mkdirSync} from 'node:fs'
import {dirname} from 'node:path'
import {createClient} from '@libsql/client'
import {drizzle} from 'drizzle-orm/libsql'
import {env} from '../env'
import * as schema from './schema'

function prepareLocalDatabase(databaseUrl: string) {
  if (!databaseUrl.startsWith('file:')) {
    return
  }

  const filePath = databaseUrl.slice('file:'.length)
  if (filePath && filePath !== ':memory:') {
    mkdirSync(dirname(filePath), {recursive: true})
  }
}

prepareLocalDatabase(env.TURSO_DATABASE_URL)

export const client = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN || undefined,
})

export const db = drizzle(client, {schema})

let ready: Promise<void> | null = null

export function ensureDatabase() {
  ready ??= client.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      text text NOT NULL,
      created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).then(() => undefined)

  return ready
}
