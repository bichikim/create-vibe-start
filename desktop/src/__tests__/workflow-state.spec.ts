import {describe, expect, it} from 'vitest'
import {
  applyWorkflowEvent,
  areRequiredToolsReady,
  canStartProject,
  normalizeDeploymentUrl,
  parseAuthenticationPrompt,
  redactLog,
  requiredToolIds,
  type StepView,
} from '../workflow-state'

describe('applyWorkflowEvent', () => {
  it('adds and updates a step without duplicating it', () => {
    const running = applyWorkflowEvent([], {
      stepId: 'generate-template',
      status: 'running',
      message: '생성 중',
    })
    const succeeded = applyWorkflowEvent(running, {
      stepId: 'generate-template',
      status: 'succeeded',
      message: '완료',
    })

    expect(succeeded).toHaveLength(1)
    expect(succeeded[0]).toMatchObject({status: 'succeeded', message: '완료'})
  })

  it('expands a failed step', () => {
    const steps: StepView[] = [
      {
        stepId: 'deploy-vercel',
        status: 'running',
        message: '배포',
        expanded: false,
      },
    ]
    expect(applyWorkflowEvent(steps, {...steps[0], status: 'failed'} satisfies StepView)[0]?.expanded).toBe(true)
  })

  it('sorts new steps into workflow order and preserves unrelated steps', () => {
    const later = applyWorkflowEvent([], {
      stepId: 'deploy-vercel',
      status: 'running',
      message: '배포',
    })
    const sorted = applyWorkflowEvent(later, {
      stepId: 'prepare-tools',
      status: 'running',
      message: '준비',
    })
    const updated = applyWorkflowEvent(sorted, {
      stepId: 'prepare-tools',
      status: 'succeeded',
      message: '준비 완료',
    })

    expect(updated.map(({stepId}) => stepId)).toEqual(['prepare-tools', 'deploy-vercel'])
    expect(updated[1]).toMatchObject({status: 'running', message: '배포'})
  })
})

describe('redactLog', () => {
  it('redacts bearer tokens and secret assignments', () => {
    expect(redactLog('Authorization: Bearer abc.def TOKEN=secret PASSWORD: nope')).toBe(
      'Authorization: Bearer [REDACTED] TOKEN=[REDACTED] PASSWORD: [REDACTED]',
    )
  })

  it('extracts only approved authentication URLs and device codes', () => {
    expect(parseAuthenticationPrompt('Open https://github.com/login/device and enter code ABCD-1234')).toEqual({
      url: 'https://github.com/login/device',
      code: 'ABCD-1234',
    })
    expect(parseAuthenticationPrompt('Open https://evil.example/login code ABCD-1234')).toEqual({
      code: 'ABCD-1234',
    })
    expect(parseAuthenticationPrompt('ordinary output')).toBeNull()
  })
})

describe('normalizeDeploymentUrl', () => {
  it('adds the root slash required by the Tauri opener scope', () => {
    expect(normalizeDeploymentUrl('https://my-app.vercel.app')).toBe('https://my-app.vercel.app/')
  })

  it('rejects non-Vercel and insecure URLs', () => {
    expect(() => normalizeDeploymentUrl('https://evil.example')).toThrow('허용되지 않은 배포 URL입니다.')
    expect(() => normalizeDeploymentUrl('http://my-app.vercel.app')).toThrow('허용되지 않은 배포 URL입니다.')
  })
})

describe('desktop form state', () => {
  it('derives required tools from selected options', () => {
    expect(
      requiredToolIds({
        createGithubRepository: true,
        deployVercel: true,
        openCodex: false,
      }),
    ).toEqual(['git', 'node', 'pnpm', 'gh', 'vercel'])
    expect(
      requiredToolIds({
        createGithubRepository: false,
        deployVercel: false,
        openCodex: true,
      }),
    ).toEqual(['git', 'node', 'pnpm', 'codex'])
  })

  it('requires every tool to be installed and authenticated', () => {
    const tools = [
      {tool: 'git' as const, installed: true, authenticated: null},
      {tool: 'gh' as const, installed: true, authenticated: false},
    ]
    expect(areRequiredToolsReady(['git'], tools)).toBe(true)
    expect(areRequiredToolsReady(['git', 'gh'], tools)).toBe(false)
    expect(areRequiredToolsReady(['node'], tools)).toBe(false)
  })

  it('prevents duplicate runs and requires identity only for GitHub', () => {
    const valid = {
      running: false,
      projectName: 'my-app',
      parentDir: '/projects',
      createGithubRepository: true,
      gitAuthorName: 'Vibe User',
      gitAuthorEmail: 'vibe@example.com',
      toolsReady: true,
    }
    expect(canStartProject(valid)).toBe(true)
    expect(canStartProject({...valid, running: true})).toBe(false)
    expect(canStartProject({...valid, gitAuthorName: ''})).toBe(false)
    expect(canStartProject({...valid, createGithubRepository: false, gitAuthorName: '', gitAuthorEmail: ''})).toBe(true)
    expect(canStartProject({...valid, toolsReady: false})).toBe(false)
    expect(canStartProject({...valid, projectName: ' '})).toBe(false)
    expect(canStartProject({...valid, projectName: 'My-app'})).toBe(false)
    expect(canStartProject({...valid, projectName: 'bad---name'})).toBe(false)
    expect(canStartProject({...valid, projectName: 'my.app_name'})).toBe(true)
    expect(canStartProject({...valid, parentDir: ' '})).toBe(false)
    expect(canStartProject({...valid, gitAuthorEmail: 'invalid'})).toBe(false)
  })
})
