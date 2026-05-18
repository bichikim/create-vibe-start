import {log} from '@clack/prompts'
import chalk from 'chalk'
import {runCommand, runCommandQuietly} from '../utils/run-command'

/**
 * 생성된 프로젝트를 GitHub CLI 로그인 계정의 새 저장소로 올립니다.
 *
 * @param projectDir - Git 명령을 실행할 생성된 프로젝트 폴더입니다.
 * @param projectName - 생성할 GitHub 저장소 이름입니다.
 * @returns 생성된 GitHub 저장소의 owner/name 형식 이름입니다.
 */
export async function createGitHubRepository(projectDir: string, projectName: string) {
  log.step(chalk.bold('GitHub 저장소 생성'))

  await runCommand('git', ['init'], 'git init', projectDir)
  await runCommand('git', ['add', '.'], 'git add .', projectDir)
  await runCommand('git', ['commit', '-m', 'Initial commit'], 'git commit -m "Initial commit"', projectDir)
  await runCommand(
    'gh',
    ['repo', 'create', projectName, '--private', '--source', '.', '--remote', 'origin', '--push'],
    `gh repo create ${projectName} --private --source . --remote origin --push`,
    projectDir,
  )
  const result = await runCommandQuietly(
    'gh',
    ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'],
    projectDir,
  )

  log.message(chalk.green(`GitHub 저장소 생성 완료: ${projectName}`))
  return result.stdout.trim()
}
