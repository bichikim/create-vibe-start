import {beforeEach, describe, expect, it, vi} from 'vitest'

const runCommandMock = vi.fn()
const runCommandQuietlyMock = vi.fn()
const confirmMock = vi.fn()
const isCancelMock = vi.fn()
const delayMock = vi.fn()
const textMock = vi.fn()
const logStepMock = vi.fn()
const logMessageMock = vi.fn()
const logWarnMock = vi.fn()

vi.mock('../../utils/run-command.js', () => ({
  runCommand: runCommandMock,
  runCommandQuietly: runCommandQuietlyMock,
}))

vi.mock('node:timers/promises', () => ({
  setTimeout: delayMock,
}))

vi.mock('@clack/prompts', () => ({
  confirm: confirmMock,
  isCancel: isCancelMock,
  log: {
    step: logStepMock,
    message: logMessageMock,
    warn: logWarnMock,
  },
  text: textMock,
}))

describe('createGitHubRepository', () => {
  beforeEach(() => {
    runCommandMock.mockReset().mockResolvedValue(undefined)
    runCommandQuietlyMock.mockReset().mockImplementation(async (command: string, args: string[]) => {
      if (command === 'git' && args[1] === 'user.name') {
        return {stdout: 'Vibe User\n'}
      }
      if (command === 'git' && args[1] === 'user.email') {
        return {stdout: 'vibe@example.com\n'}
      }
      return {stdout: 'bichikim/my-app\n'}
    })
    confirmMock.mockReset().mockResolvedValue(true)
    isCancelMock.mockReset().mockReturnValue(false)
    delayMock.mockReset().mockResolvedValue(undefined)
    textMock.mockReset().mockResolvedValue('unused')
    logStepMock.mockReset()
    logMessageMock.mockReset()
    logWarnMock.mockReset()
  })

  it('initializes git, commits the template, and creates a private GitHub repository', async () => {
    const {createGitHubRepository} = await import('../create-github-repository')

    const result = await createGitHubRepository('/repo/my-app', 'my-app')

    expect(runCommandMock).toHaveBeenNthCalledWith(1, 'git', ['init'], 'git init', '/repo/my-app')
    expect(runCommandQuietlyMock).toHaveBeenCalledWith('git', ['config', 'user.name'], '/repo/my-app')
    expect(runCommandQuietlyMock).toHaveBeenCalledWith('git', ['config', 'user.email'], '/repo/my-app')
    expect(confirmMock).not.toHaveBeenCalled()
    expect(textMock).not.toHaveBeenCalled()
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

  it('configures missing git identity locally before committing', async () => {
    runCommandQuietlyMock.mockImplementation(async (command: string, args: string[]) => {
      if (command === 'git') {
        throw new Error(`missing ${args[1]}`)
      }
      return {stdout: 'bichikim/my-app\n'}
    })
    textMock.mockResolvedValueOnce('  Vibe User  ').mockResolvedValueOnce('  vibe@example.com  ')
    const {createGitHubRepository} = await import('../create-github-repository')

    await expect(createGitHubRepository('/repo/my-app', 'my-app')).resolves.toBe('bichikim/my-app')

    expect(confirmMock).toHaveBeenCalledWith({
      message: 'Git commit 작성자 정보가 없습니다. 이 프로젝트에만 설정할까요?',
      initialValue: true,
    })
    expect(textMock).toHaveBeenNthCalledWith(1, {
      message: 'Git commit 작성자 이름을 입력해주세요.',
      placeholder: 'Your Name',
      initialValue: '',
      validate: expect.any(Function),
    })
    expect(textMock).toHaveBeenNthCalledWith(2, {
      message: 'Git commit 작성자 이메일을 입력해주세요.',
      placeholder: 'you@example.com',
      initialValue: '',
      validate: expect.any(Function),
    })
    expect(runCommandMock).toHaveBeenNthCalledWith(
      2,
      'git',
      ['config', 'user.name', 'Vibe User'],
      'git config user.name',
      '/repo/my-app',
    )
    expect(runCommandMock).toHaveBeenNthCalledWith(
      3,
      'git',
      ['config', 'user.email', 'vibe@example.com'],
      'git config user.email',
      '/repo/my-app',
    )
    expect(runCommandMock).toHaveBeenNthCalledWith(4, 'git', ['add', '.'], 'git add .', '/repo/my-app')
  })

  it('retries the read-only GitHub repository lookup when it fails with a network error', async () => {
    runCommandQuietlyMock.mockImplementation(async (command: string, args: string[]) => {
      if (command === 'git' && args[1] === 'user.name') {
        return {stdout: 'Vibe User\n'}
      }
      if (command === 'git' && args[1] === 'user.email') {
        return {stdout: 'vibe@example.com\n'}
      }
      if (command === 'gh') {
        if (runCommandQuietlyMock.mock.calls.filter(([calledCommand]) => calledCommand === 'gh').length === 1) {
          throw Object.assign(new Error('request failed'), {code: 'ENOTFOUND'})
        }

        return {stdout: 'bichikim/my-app\n'}
      }

      return {stdout: ''}
    })
    const {createGitHubRepository} = await import('../create-github-repository')

    await expect(createGitHubRepository('/repo/my-app', 'my-app')).resolves.toBe('bichikim/my-app')

    expect(runCommandMock).toHaveBeenCalledTimes(4)
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
    expect(runCommandQuietlyMock.mock.calls.filter(([command]) => command === 'gh')).toHaveLength(2)
  })

  it('does not retry GitHub repository creation failures', async () => {
    const createError = new Error('repo already exists')
    runCommandMock.mockImplementation(async (command: string, args: string[]) => {
      if (command === 'gh' && args[0] === 'repo' && args[1] === 'create') {
        throw createError
      }
    })
    const {createGitHubRepository} = await import('../create-github-repository')

    await expect(createGitHubRepository('/repo/my-app', 'my-app')).rejects.toBe(createError)

    expect(runCommandMock.mock.calls.filter(([command]) => command === 'gh')).toHaveLength(1)
    expect(runCommandQuietlyMock.mock.calls.filter(([command]) => command === 'gh')).toHaveLength(0)
  })

  it('uses existing git identity values as prompt defaults when one value is missing', async () => {
    runCommandQuietlyMock.mockImplementation(async (command: string, args: string[]) => {
      if (command === 'git' && args[1] === 'user.name') {
        return {stdout: 'Existing User\n'}
      }
      if (command === 'git' && args[1] === 'user.email') {
        throw new Error('missing email')
      }
      return {stdout: 'bichikim/my-app\n'}
    })
    textMock.mockResolvedValueOnce('Existing User').mockResolvedValueOnce('vibe@example.com')
    const {createGitHubRepository} = await import('../create-github-repository')

    await createGitHubRepository('/repo/my-app', 'my-app')

    expect(textMock).toHaveBeenNthCalledWith(1, expect.objectContaining({initialValue: 'Existing User'}))
    expect(textMock).toHaveBeenNthCalledWith(2, expect.objectContaining({initialValue: ''}))
  })

  it('stops before commit when git identity setup is declined', async () => {
    runCommandQuietlyMock.mockImplementation(async (command: string, args: string[]) => {
      if (command === 'git') {
        throw new Error(`missing ${args[1]}`)
      }
      return {stdout: 'bichikim/my-app\n'}
    })
    confirmMock.mockResolvedValue(false)
    const {createGitHubRepository} = await import('../create-github-repository')

    await expect(createGitHubRepository('/repo/my-app', 'my-app')).rejects.toThrow(
      'Git commit 작성자 정보가 없어 GitHub 저장소 생성을 진행할 수 없습니다.',
    )

    expect(runCommandMock).toHaveBeenCalledTimes(1)
    expect(runCommandMock).toHaveBeenCalledWith('git', ['init'], 'git init', '/repo/my-app')
  })

  it('stops before commit when git identity name input is cancelled', async () => {
    runCommandQuietlyMock.mockImplementation(async (command: string, args: string[]) => {
      if (command === 'git') {
        throw new Error(`missing ${args[1]}`)
      }
      return {stdout: 'bichikim/my-app\n'}
    })
    isCancelMock.mockImplementation((value: unknown) => value === 'cancel')
    textMock.mockResolvedValueOnce('cancel')
    const {createGitHubRepository} = await import('../create-github-repository')

    await expect(createGitHubRepository('/repo/my-app', 'my-app')).rejects.toThrow(
      'Git commit 작성자 정보 설정을 취소했습니다.',
    )

    expect(runCommandMock).toHaveBeenCalledTimes(1)
    expect(runCommandMock).toHaveBeenCalledWith('git', ['init'], 'git init', '/repo/my-app')
  })

  it('stops before commit when git identity email input is cancelled', async () => {
    runCommandQuietlyMock.mockImplementation(async (command: string, args: string[]) => {
      if (command === 'git') {
        throw new Error(`missing ${args[1]}`)
      }
      return {stdout: 'bichikim/my-app\n'}
    })
    isCancelMock.mockImplementation((value: unknown) => value === 'cancel')
    textMock.mockResolvedValueOnce('Vibe User').mockResolvedValueOnce('cancel')
    const {createGitHubRepository} = await import('../create-github-repository')

    await expect(createGitHubRepository('/repo/my-app', 'my-app')).rejects.toThrow(
      'Git commit 작성자 정보 설정을 취소했습니다.',
    )

    expect(runCommandMock).toHaveBeenCalledTimes(1)
    expect(runCommandMock).toHaveBeenCalledWith('git', ['init'], 'git init', '/repo/my-app')
  })

  it('validates git identity prompt values', async () => {
    runCommandQuietlyMock.mockImplementation(async (command: string) => {
      if (command === 'git') {
        throw new Error('missing identity')
      }
      return {stdout: 'bichikim/my-app\n'}
    })
    const {createGitHubRepository} = await import('../create-github-repository')

    await createGitHubRepository('/repo/my-app', 'my-app')

    const namePrompt = textMock.mock.calls[0][0] as {validate: (value: string) => string | undefined}
    const emailPrompt = textMock.mock.calls[1][0] as {validate: (value: string) => string | undefined}
    expect(namePrompt.validate('')).toBe('이름을 입력해주세요.')
    expect(namePrompt.validate('Vibe User')).toBeUndefined()
    expect(emailPrompt.validate('missing-at')).toBe('이메일을 입력해주세요.')
    expect(emailPrompt.validate('vibe@example.com')).toBeUndefined()
  })
})
