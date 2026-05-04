import {setupTool} from './setup-tool.js'

export async function setupVercel() {
  return setupTool({
    name: 'Vercel',
    command: 'vercel',
    versionArgs: ['--version'],
    authCheckArgs: ['whoami'],
    loginArgs: ['login'],
    install: {
      macos: {
        command: 'pnpm',
        args: ['add', '-g', 'vercel'],
        label: 'pnpm add -g vercel',
      },
      windows: {
        command: 'pnpm',
        args: ['add', '-g', 'vercel'],
        label: 'pnpm add -g vercel',
      },
      linux: {
        command: 'pnpm',
        args: ['add', '-g', 'vercel'],
        label: 'pnpm add -g vercel',
      },
    },
  })
}
