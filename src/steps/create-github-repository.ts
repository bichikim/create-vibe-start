import {confirm, isCancel, log, text} from '@clack/prompts'
import chalk from 'chalk'
import {withNetworkRetry} from '../utils/network-retry'
import {runCommand, runCommandQuietly} from '../utils/run-command'

export type GitCommitIdentity = {
  name: string
  email: string
}

export type GitHubVisibility = 'private' | 'public'

/**
 * 생성된 프로젝트를 GitHub CLI 로그인 계정의 새 저장소로 올립니다.
 *
 * @param projectDir - Git 명령을 실행할 생성된 프로젝트 폴더입니다.
 * @param projectName - 생성할 GitHub 저장소 이름입니다.
 * @returns 생성된 GitHub 저장소의 owner/name 형식 이름입니다.
 */
export async function createGitHubRepository(
  projectDir: string,
  projectName: string,
  identity?: GitCommitIdentity,
  visibility: GitHubVisibility = 'private',
) {
  log.step(chalk.bold('GitHub 저장소 생성'))

  await runCommand('git', ['init'], 'git init', projectDir)
  await ensureGitCommitIdentity(projectDir, identity)
  await runCommand('git', ['add', '.'], 'git add .', projectDir)
  await runCommand('git', ['commit', '-m', 'Initial commit'], 'git commit -m "Initial commit"', projectDir)
  await runCommand(
    'gh',
    ['repo', 'create', projectName, `--${visibility}`, '--source', '.', '--remote', 'origin', '--push'],
    `gh repo create ${projectName} --${visibility} --source . --remote origin --push`,
    projectDir,
  )
  const result = await withNetworkRetry('gh repo view', () =>
    runCommandQuietly('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], projectDir),
  )

  log.message(chalk.green(`GitHub 저장소 생성 완료: ${projectName}`))
  return result.stdout.trim()
}

export async function ensureGitCommitIdentity(projectDir: string, identity?: GitCommitIdentity) {
  const [name, email] = await Promise.all([
    readGitConfig(projectDir, 'user.name'),
    readGitConfig(projectDir, 'user.email'),
  ])

  if (name && email) {
    return
  }

  if (identity) {
    const authorName = identity.name.trim()
    const authorEmail = identity.email.trim()
    if (!authorName || !authorEmail.includes('@')) {
      throw new Error('Git commit 작성자 이름과 이메일을 확인해주세요.')
    }
    await runCommand('git', ['config', 'user.name', authorName], 'git config user.name', projectDir)
    await runCommand('git', ['config', 'user.email', authorEmail], 'git config user.email', projectDir)
    return
  }

  const shouldConfigure = await confirm({
    message: 'Git commit 작성자 정보가 없습니다. 이 프로젝트에만 설정할까요?',
    initialValue: true,
  })

  if (isCancel(shouldConfigure) || !shouldConfigure) {
    throw new Error('Git commit 작성자 정보가 없어 GitHub 저장소 생성을 진행할 수 없습니다.')
  }

  const authorName = await text({
    message: 'Git commit 작성자 이름을 입력해주세요.',
    placeholder: 'Your Name',
    initialValue: name,
    validate(value) {
      return value.trim() ? undefined : '이름을 입력해주세요.'
    },
  })

  if (isCancel(authorName)) {
    throw new Error('Git commit 작성자 정보 설정을 취소했습니다.')
  }

  const authorEmail = await text({
    message: 'Git commit 작성자 이메일을 입력해주세요.',
    placeholder: 'you@example.com',
    initialValue: email,
    validate(value) {
      const trimmed = value.trim()
      return trimmed && trimmed.includes('@') ? undefined : '이메일을 입력해주세요.'
    },
  })

  if (isCancel(authorEmail)) {
    throw new Error('Git commit 작성자 정보 설정을 취소했습니다.')
  }

  await runCommand('git', ['config', 'user.name', authorName.trim()], 'git config user.name', projectDir)
  await runCommand('git', ['config', 'user.email', authorEmail.trim()], 'git config user.email', projectDir)
}

async function readGitConfig(projectDir: string, key: 'user.name' | 'user.email') {
  try {
    const result = await runCommandQuietly('git', ['config', key], projectDir)
    return result.stdout.trim()
  } catch {
    return ''
  }
}
