import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const logStepMock = vi.fn()
const logMessageMock = vi.fn()

vi.mock('@clack/prompts', () => ({
  log: {
    step: logStepMock,
    message: logMessageMock,
  },
}))

describe('generateTemplate', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'create-vibe-start-'))
    logStepMock.mockReset()
    logMessageMock.mockReset()
  })

  afterEach(async () => {
    await rm(testDir, {recursive: true, force: true})
  })

  it('generates a README.md file in the project directory', async () => {
    const projectDir = join(testDir, 'project')
    const {generateTemplate} = await import('../generate-template')

    await generateTemplate(projectDir)

    await expect(readFile(join(projectDir, 'README.md'), 'utf8')).resolves.toBe('# hellow vibe code\n')
    expect(logStepMock).toHaveBeenCalledWith('프로젝트 템플릿 생성')
    expect(logMessageMock).toHaveBeenCalledWith(`README.md 생성 완료: ${projectDir}`)
  })

  it('overwrites an existing README.md file', async () => {
    const projectDir = join(testDir, 'project')
    await mkdir(projectDir)
    await writeFile(join(projectDir, 'README.md'), '# existing\n')
    const {generateTemplate} = await import('../generate-template')

    await generateTemplate(projectDir)

    await expect(readFile(join(projectDir, 'README.md'), 'utf8')).resolves.toBe('# hellow vibe code\n')
  })
})
