import {commandExists} from '../utils/command-exists'
import {type SetupStep, setupTool} from './setup-tool'

export const setupVercel: SetupStep = async () => {
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
