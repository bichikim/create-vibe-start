import {type ChildProcess, spawn} from 'node:child_process'
import type {AddressInfo} from 'node:net'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import type {Plugin} from 'vite'

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)))
const withXcodeScript = join(packageDir, 'scripts/with-xcode.mjs')

const mobileModes = {
  ios: {
    command: 'node',
    args: [withXcodeScript, 'cap', 'run', 'ios', '--live-reload', '--host', 'localhost'],
  },
  android: {
    command: 'cap',
    args: ['run', 'android', '--live-reload', '--host', '10.0.2.2'],
  },
} satisfies Record<string, {command: string; args: string[]}>

function getServerPort(address: AddressInfo | string | null): string {
  if (!address || typeof address === 'string') {
    throw new Error('Could not read the Vite dev server port.')
  }

  return String(address.port)
}

export function capacitorRun(mode: string): Plugin {
  const target = mobileModes[mode as keyof typeof mobileModes]

  return {
    name: 'vibe-capacitor-run',
    apply: 'serve',
    configureServer(server) {
      if (!target) {
        return
      }

      let child: ChildProcess | undefined

      server.httpServer?.once('listening', () => {
        const port = getServerPort(server.httpServer?.address() ?? null)
        child = spawn(target.command, [...target.args, '--port', port], {
          env: process.env,
          stdio: 'inherit',
        })

        child.once('exit', (code) => {
          server.close().finally(() => process.exit(code ?? 1))
        })
      })

      server.httpServer?.once('close', () => {
        child?.kill('SIGTERM')
      })
    },
  }
}
