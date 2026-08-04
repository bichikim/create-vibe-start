import {beforeEach, describe, expect, it, vi} from 'vitest'

const confirmMock = vi.fn()
const selectMock = vi.fn()
const textMock = vi.fn()
const runCommandMock = vi.fn()
const runCommandQuietlyMock = vi.fn()
const createGitHubRepositoryMock = vi.fn()
const ensureGitCommitIdentityMock = vi.fn()
const cancel = Symbol('cancel')

vi.mock('@clack/prompts', () => ({
  confirm: confirmMock,
  select: selectMock,
  text: textMock,
  isCancel: (value: unknown) => value === cancel,
}))

vi.mock('../../utils/network-retry', () => ({
  withNetworkRetry: (_label: string, operation: () => unknown) => operation(),
}))

vi.mock('../../utils/run-command', () => ({
  runCommand: runCommandMock,
  runCommandQuietly: runCommandQuietlyMock,
}))

vi.mock('../create-github-repository', () => ({
  createGitHubRepository: createGitHubRepositoryMock,
  ensureGitCommitIdentity: ensureGitCommitIdentityMock,
}))

describe('connectGitHubProject', () => {
  beforeEach(() => {
    confirmMock.mockReset().mockResolvedValue(false)
    selectMock.mockReset()
    textMock.mockReset()
    runCommandMock.mockReset().mockResolvedValue(undefined)
    runCommandQuietlyMock.mockReset()
    createGitHubRepositoryMock.mockReset().mockResolvedValue('owner/new-repo')
    ensureGitCommitIdentityMock.mockReset().mockResolvedValue(undefined)
  })

  it('reuses an already connected repository', async () => {
    runCommandQuietlyMock.mockResolvedValue({stdout: 'owner/repo\n'})
    const {connectGitHubProject, readGitHubRepository} = await import('../connect-github-project')

    await expect(readGitHubRepository('/repo')).resolves.toBe('owner/repo')
    await expect(connectGitHubProject('/repo', 'repo')).resolves.toBe('owner/repo')
    expect(selectMock).not.toHaveBeenCalled()
  })

  it('returns undefined when the current repository cannot be resolved', async () => {
    runCommandQuietlyMock.mockRejectedValue(new Error('missing'))
    const {readGitHubRepository} = await import('../connect-github-project')

    await expect(readGitHubRepository('/repo')).resolves.toBeUndefined()
  })

  it('returns undefined for an empty repository response', async () => {
    runCommandQuietlyMock.mockResolvedValue({stdout: '  '})
    const {readGitHubRepository} = await import('../connect-github-project')

    await expect(readGitHubRepository('/repo')).resolves.toBeUndefined()
  })

  it.each(['private', 'public'] as const)('creates a new %s repository', async (visibility) => {
    runCommandQuietlyMock.mockRejectedValue(new Error('missing'))
    selectMock.mockResolvedValueOnce('new').mockResolvedValueOnce(visibility)
    const {connectGitHubProject} = await import('../connect-github-project')

    await expect(connectGitHubProject('/repo', 'repo')).resolves.toBe('owner/new-repo')
    expect(createGitHubRepositoryMock).toHaveBeenCalledWith('/repo', 'repo', undefined, visibility)
  })

  it('connects an existing repository without pushing', async () => {
    runCommandQuietlyMock.mockRejectedValueOnce(new Error('missing')).mockResolvedValueOnce({stdout: '{}'})
    selectMock.mockResolvedValue('existing')
    textMock.mockResolvedValue(' owner/repo ')
    const {connectGitHubProject} = await import('../connect-github-project')

    await expect(connectGitHubProject('/repo', 'repo')).resolves.toBe('owner/repo')
    const prompt = textMock.mock.calls[0][0] as {validate(value: string): string | undefined}
    expect(prompt.validate('owner/repo')).toBeUndefined()
    expect(prompt.validate('invalid')).toBe('owner/name 형식으로 입력해주세요.')
    expect(runCommandMock).toHaveBeenNthCalledWith(1, 'git', ['init'], 'git init', '/repo')
    expect(runCommandMock).toHaveBeenNthCalledWith(
      2,
      'git',
      ['remote', 'add', 'origin', 'https://github.com/owner/repo.git'],
      'git remote add origin https://github.com/owner/repo.git',
      '/repo',
    )
  })

  it('does not push when push confirmation is cancelled', async () => {
    runCommandQuietlyMock.mockRejectedValueOnce(new Error('missing')).mockResolvedValueOnce({stdout: '{}'})
    selectMock.mockResolvedValue('existing')
    textMock.mockResolvedValue('owner/repo')
    confirmMock.mockResolvedValue(cancel)
    const {connectGitHubProject} = await import('../connect-github-project')

    await connectGitHubProject('/repo', 'repo')

    expect(runCommandMock).not.toHaveBeenCalledWith(
      'git',
      ['push', '-u', 'origin', 'HEAD'],
      'git push -u origin HEAD',
      '/repo',
    )
  })

  it.each([
    [true, {stdout: 'head'}, false],
    [true, new Error('no head'), true],
  ])('optionally pushes an existing repository', async (_push, headResult, createsCommit) => {
    runCommandQuietlyMock
      .mockRejectedValueOnce(new Error('missing'))
      .mockResolvedValueOnce({stdout: '{}'})
      .mockImplementationOnce(() => {
        return headResult instanceof Error ? Promise.reject(headResult) : Promise.resolve(headResult)
      })
    selectMock.mockResolvedValue('existing')
    textMock.mockResolvedValue('owner/repo')
    confirmMock.mockResolvedValue(true)
    const {connectGitHubProject} = await import('../connect-github-project')

    await connectGitHubProject('/repo', 'repo')

    expect(ensureGitCommitIdentityMock).toHaveBeenCalledTimes(createsCommit ? 1 : 0)
    expect(runCommandMock).toHaveBeenCalledWith(
      'git',
      ['push', '-u', 'origin', 'HEAD'],
      'git push -u origin HEAD',
      '/repo',
    )
  })

  it.each([
    ['mode', [cancel]],
    ['visibility', ['new', cancel]],
  ])('handles cancellation at %s selection', async (_label, answers) => {
    runCommandQuietlyMock.mockRejectedValue(new Error('missing'))
    selectMock.mockResolvedValueOnce(answers[0]).mockResolvedValueOnce(answers[1])
    const {connectGitHubProject} = await import('../connect-github-project')

    await expect(connectGitHubProject('/repo', 'repo')).rejects.toThrow('GitHub 저장소 연결을 취소했습니다.')
  })

  it('handles cancellation while entering an existing repository', async () => {
    runCommandQuietlyMock.mockRejectedValue(new Error('missing'))
    selectMock.mockResolvedValue('existing')
    textMock.mockResolvedValue(cancel)
    const {connectGitHubProject} = await import('../connect-github-project')

    await expect(connectGitHubProject('/repo', 'repo')).rejects.toThrow('GitHub 저장소 연결을 취소했습니다.')
  })
})
