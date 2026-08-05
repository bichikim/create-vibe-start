import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

describe('project-setup-config', () => {
  let projectDir: string

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), 'vibe-start-config-'))
  })

  afterEach(async () => {
    await rm(projectDir, {force: true, recursive: true})
  })

  it('returns an empty config only when the file is missing', async () => {
    const {readProjectSetupConfig} = await import('../project-setup-config')

    await expect(readProjectSetupConfig(projectDir)).resolves.toEqual({schemaVersion: 1})
  })

  it.each([
    JSON.stringify({schemaVersion: 2}),
    'null',
    JSON.stringify({schemaVersion: 1, mobile: {iosBundleId: 123}}),
    JSON.stringify({schemaVersion: 1, codemagic: {applicationId: ' '}}),
  ])('rejects invalid config instead of silently resetting it', async (content) => {
    const {readProjectSetupConfig} = await import('../project-setup-config')

    await writeFile(join(projectDir, 'vibe-start.config.json'), content)
    await expect(readProjectSetupConfig(projectDir)).rejects.toThrow('프로젝트 설정 파일의 형식이 올바르지 않습니다.')
  })

  it('reports config read failures instead of silently resetting them', async () => {
    const {readProjectSetupConfig} = await import('../project-setup-config')

    await mkdir(join(projectDir, 'vibe-start.config.json'))
    await expect(readProjectSetupConfig(projectDir)).rejects.toThrow('프로젝트 설정 파일을 읽을 수 없습니다.')
  })

  it('reads and writes non-secret deployment identifiers', async () => {
    const {readProjectSetupConfig, writeProjectSetupConfig} = await import('../project-setup-config')
    const config = {
      schemaVersion: 1,
      mobile: {iosBundleId: 'com.example.ios'},
      codemagic: {applicationId: 'app-id'},
    } as const

    await writeProjectSetupConfig(projectDir, config)

    await expect(readProjectSetupConfig(projectDir)).resolves.toEqual(config)
    await expect(readFile(join(projectDir, 'vibe-start.config.json'), 'utf8')).resolves.toBe(
      `${JSON.stringify(config, null, 2)}\n`,
    )
  })
})
