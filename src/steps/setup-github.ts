import {setupTool} from './setup-tool.js'

export async function setupGitHub() {
  return setupTool({
    name: 'GitHub',
    command: 'gh',
    commandLabel: 'gh (github)',
    versionArgs: ['--version'],
    authCheckArgs: ['auth', 'status'],
    loginArgs: ['auth', 'login'],
    install: {
      macos: {
        command: 'brew',
        args: ['install', 'gh'],
        label: 'brew install gh',
      },
      windows: {
        command: 'winget',
        args: ['install', '--id', 'GitHub.cli'],
        label: 'winget install --id GitHub.cli',
      },
      linux: {
        command: 'gh',
        args: [],
        label: 'https://github.com/cli/cli/blob/trunk/docs/install_linux.md 참고',
      },
    },
  })
}
