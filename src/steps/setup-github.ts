import {type SetupStep, setupTool} from './setup-tool'

/** GitHub CLI 설치, 버전 확인, 로그인 상태 확인을 수행합니다. */
export const setupGitHub: SetupStep = async () => {
  const gitResult = await setupTool({
    name: 'Git',
    command: 'git',
    versionArgs: ['--version'],
    install: {
      macos: {
        command: 'brew',
        args: ['install', 'git'],
        label: 'brew install git',
      },
      windows: {
        command: 'winget',
        args: ['install', '--id', 'Git.Git'],
        label: 'winget install --id Git.Git',
      },
      linux: {
        command: 'sh',
        args: [
          '-c',
          'DEBIAN_FRONTEND=noninteractive apt-get update -qq && apt-get install -y --no-install-recommends git',
        ],
        label: 'apt-get install git (Debian/Ubuntu 계열)',
      },
    },
  })

  if (gitResult.status !== 'ready') {
    return {
      name: 'GitHub',
      status: gitResult.status,
      message: `Git 준비 실패: ${gitResult.message}`,
    }
  }

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
