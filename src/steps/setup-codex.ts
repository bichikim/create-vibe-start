import {commandExists} from '../utils/command-exists'
import {type SetupStep, setupTool} from './setup-tool'

export const setupCodex: SetupStep = async () => {
  const installCommand = (await commandExists('pnpm'))
    ? {
        command: 'pnpm',
        args: ['add', '-g', '@openai/codex'],
        label: 'pnpm add -g @openai/codex',
      }
    : {
        command: 'npm',
        args: ['install', '-g', '@openai/codex'],
        label: 'npm install -g @openai/codex',
      }

  return setupTool({
    name: 'Codex',
    command: 'codex',
    versionArgs: ['--version'],
    authCheckArgs: ['login', 'status'],
    loginArgs: ['login'],
    install: {
      macos: installCommand,
      windows: installCommand,
      linux: installCommand,
    },
  })
}
