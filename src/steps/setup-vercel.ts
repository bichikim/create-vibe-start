import {commandExists} from '../utils/command-exists.js'
import {setupTool} from './setup-tool.js'

export async function setupVercel() {
  const installCommand = (await commandExists('pnpm'))
    ? {
        command: 'pnpm',
        args: ['add', '-g', 'vercel'],
        label: 'pnpm add -g vercel',
      }
    : {
        command: 'npm',
        args: ['install', '-g', 'vercel'],
        label: 'npm install -g vercel',
      }

  return setupTool({
    name: 'Vercel',
    command: 'vercel',
    versionArgs: ['--version'],
    authCheckArgs: ['whoami'],
    loginArgs: ['login'],
    install: {
      macos: installCommand,
      windows: installCommand,
      linux: installCommand,
    },
  })
}
