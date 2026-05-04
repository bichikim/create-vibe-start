import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {describe, expect, it} from 'vitest'

describe('package bin entry', () => {
  it('publishes the built CLI file for global installs', async () => {
    const root = resolve(__dirname, '../..')
    const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')) as {
      bin: Record<string, string>
      files: string[]
      scripts: Record<string, string>
    }

    expect(packageJson.bin).toEqual({'create-vibe-start': './dist/cli.js'})
    expect(packageJson.files).toEqual(['dist'])
    expect(packageJson.scripts['reset:environment']).toBe('tsx src/cli.ts reset')
    expect(packageJson.scripts['reset:dev-tools']).toBe('tsx src/cli.ts reset')
    expect(packageJson.scripts.start).toBe('node dist/cli.js')
  })
})
