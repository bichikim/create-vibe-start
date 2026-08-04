import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
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

  it('returns an empty config when the file is missing or invalid', async () => {
    const {readProjectSetupConfig} = await import('../project-setup-config')

    await expect(readProjectSetupConfig(projectDir)).resolves.toEqual({schemaVersion: 1})
    await writeFile(join(projectDir, 'vibe-start.config.json'), JSON.stringify({schemaVersion: 2}))
    await expect(readProjectSetupConfig(projectDir)).resolves.toEqual({schemaVersion: 1})
    await writeFile(join(projectDir, 'vibe-start.config.json'), 'null')
    await expect(readProjectSetupConfig(projectDir)).resolves.toEqual({schemaVersion: 1})
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
