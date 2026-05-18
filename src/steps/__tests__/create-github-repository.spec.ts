import {beforeEach, describe, expect, it, vi} from 'vitest'

const runCommandMock = vi.fn()
const runCommandQuietlyMock = vi.fn()
const logStepMock = vi.fn()
const logMessageMock = vi.fn()

vi.mock('../../utils/run-command.js', () => ({
  runCommand: runCommandMock,
  runCommandQuietly: runCommandQuietlyMock,
}))

vi.mock('@clack/prompts', () => ({
  log: {
    step: logStepMock,
    message: logMessageMock,
  },
}))

describe('createGitHubRepository', () => {
  beforeEach(() => {
    runCommandMock.mockReset().mockResolvedValue(undefined)
    runCommandQuietlyMock.mockReset().mockResolvedValue({stdout: 'bichikim/my-app\n'})
    logStepMock.mockReset()
    logMessageMock.mockReset()
  })

  it('initializes git, commits the template, and creates a private GitHub repository', async () => {
    const {createGitHubRepository} = await import('../create-github-repository')

    const result = await createGitHubRepository('/repo/my-app', 'my-app')

    expect(runCommandMock).toHaveBeenNthCalledWith(1, 'git', ['init'], 'git init', '/repo/my-app')
    expect(runCommandMock).toHaveBeenNthCalledWith(2, 'git', ['add', '.'], 'git add .', '/repo/my-app')
    expect(runCommandMock).toHaveBeenNthCalledWith(
      3,
      'git',
      ['commit', '-m', 'Initial commit'],
      'git commit -m "Initial commit"',
      '/repo/my-app',
    )
    expect(runCommandMock).toHaveBeenNthCalledWith(
      4,
      'gh',
      ['repo', 'create', 'my-app', '--private', '--source', '.', '--remote', 'origin', '--push'],
      'gh repo create my-app --private --source . --remote origin --push',
      '/repo/my-app',
    )
    expect(runCommandQuietlyMock).toHaveBeenCalledWith(
      'gh',
      ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'],
      '/repo/my-app',
    )
    expect(logStepMock).toHaveBeenCalledWith('GitHub 저장소 생성')
    expect(logMessageMock).toHaveBeenCalledWith('GitHub 저장소 생성 완료: my-app')
    expect(result).toBe('bichikim/my-app')
  })
})
