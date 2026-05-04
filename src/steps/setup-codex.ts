import {setupTool} from './setup-tool.js'

export async function setupCodex() {
  return setupTool({
    name: 'Codex',
    command: 'codex',
    versionArgs: ['--version'],
    authCheckArgs: ['login', 'status'],
    loginArgs: ['login'],
    install: {
      macos: {
        command: 'pnpm',
        args: ['add', '-g', '@openai/codex'],
        label: 'pnpm add -g @openai/codex',
      },
      windows: {
        command: 'pnpm',
        args: ['add', '-g', '@openai/codex'],
        label: 'pnpm add -g @openai/codex',
      },
      linux: {
        command: 'pnpm',
        args: ['add', '-g', '@openai/codex'],
        label: 'pnpm add -g @openai/codex',
      },
    },
  })
}
