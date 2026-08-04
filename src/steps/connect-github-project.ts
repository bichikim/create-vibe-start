import {confirm, isCancel, select, text} from '@clack/prompts'
import {withNetworkRetry} from '../utils/network-retry'
import {runCommand, runCommandQuietly} from '../utils/run-command'
import {createGitHubRepository, ensureGitCommitIdentity, type GitHubVisibility} from './create-github-repository'

const REPOSITORY_PATTERN = /^[^/\s]+\/[^/\s]+$/u

export async function readGitHubRepository(projectDir: string): Promise<string | undefined> {
  try {
    const result = await withNetworkRetry('gh repo view', () =>
      runCommandQuietly('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], projectDir),
    )
    return result.stdout.trim() || undefined
  } catch {
    // 아직 Git 저장소가 아니거나 GitHub remote가 없는 상태는 후속 연결이 가능한 정상 상태다.
    return undefined
  }
}

/** Connects a generated project to either a new or an existing GitHub repository. */
export async function connectGitHubProject(projectDir: string, projectName: string): Promise<string> {
  const connectedRepository = await readGitHubRepository(projectDir)
  if (connectedRepository !== undefined) {
    // 반복 실행 시 이미 연결된 저장소를 그대로 사용해 remote를 중복 생성하지 않는다.
    return connectedRepository
  }

  const mode = await select({
    message: 'GitHub 저장소를 어떻게 연결할까요?',
    options: [
      {label: '새 저장소 만들기', value: 'new'},
      {label: '기존 저장소 연결', value: 'existing'},
    ],
  })
  if (isCancel(mode)) {
    throw new Error('GitHub 저장소 연결을 취소했습니다.')
  }

  if (mode === 'new') {
    const visibility = await select({
      message: '저장소 공개 범위를 선택해주세요.',
      options: [
        {label: '비공개', value: 'private'},
        {label: '공개', value: 'public'},
      ],
    })
    if (isCancel(visibility)) {
      throw new Error('GitHub 저장소 연결을 취소했습니다.')
    }

    return createGitHubRepository(projectDir, projectName, undefined, visibility as GitHubVisibility)
  }

  const repository = await text({
    message: '연결할 GitHub 저장소를 owner/name 형식으로 입력해주세요.',
    placeholder: `owner/${projectName}`,
    validate(value) {
      return REPOSITORY_PATTERN.test(value.trim()) ? undefined : 'owner/name 형식으로 입력해주세요.'
    },
  })
  if (isCancel(repository)) {
    throw new Error('GitHub 저장소 연결을 취소했습니다.')
  }

  const normalizedRepository = repository.trim()
  // remote를 추가하기 전에 저장소 접근 권한과 owner/name이 실제로 유효한지 확인한다.
  await withNetworkRetry('gh repo view', () =>
    runCommandQuietly('gh', ['repo', 'view', normalizedRepository, '--json', 'nameWithOwner'], projectDir),
  )
  await runCommand('git', ['init'], 'git init', projectDir)
  await runCommand(
    'git',
    ['remote', 'add', 'origin', `https://github.com/${normalizedRepository}.git`],
    `git remote add origin https://github.com/${normalizedRepository}.git`,
    projectDir,
  )

  const shouldPush = await confirm({
    message: '현재 프로젝트를 기존 저장소에 push할까요?',
    initialValue: false,
  })
  if (!isCancel(shouldPush) && shouldPush) {
    await ensureInitialCommit(projectDir)
    await runCommand('git', ['push', '-u', 'origin', 'HEAD'], 'git push -u origin HEAD', projectDir)
  }

  return normalizedRepository
}

async function ensureInitialCommit(projectDir: string) {
  try {
    await runCommandQuietly('git', ['rev-parse', '--verify', 'HEAD'], projectDir)
  } catch {
    await ensureGitCommitIdentity(projectDir)
    await runCommand('git', ['add', '.'], 'git add .', projectDir)
    await runCommand('git', ['commit', '-m', 'Initial commit'], 'git commit -m "Initial commit"', projectDir)
  }
}
