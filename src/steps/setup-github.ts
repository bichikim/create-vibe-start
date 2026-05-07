import {type SetupStep, setupTool} from './setup-tool'

/** GitHub CLI 설치, 버전 확인, 로그인 상태 확인을 수행합니다. */
export const setupGitHub: SetupStep = async () => {
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
