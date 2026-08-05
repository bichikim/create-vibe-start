import {describe, expect, it} from 'vitest'
import {developmentCliArguments} from '../development-workflow'

describe('developmentCliArguments', () => {
  it('passes the packed CLI to the normal development project command', () => {
    expect(developmentCliArguments('/tmp/create-vibe-start.tgz')).toEqual([
      'exec',
      'tsx',
      'src/cli.ts',
      '--project-dir',
      './.test-project',
      '--local-setup-package',
      '/tmp/create-vibe-start.tgz',
    ])
  })

  it('keeps extra development arguments after the local package option', () => {
    expect(developmentCliArguments('/tmp/create-vibe-start.tgz', ['--skip-github'])).toEqual([
      'exec',
      'tsx',
      'src/cli.ts',
      '--project-dir',
      './.test-project',
      '--local-setup-package',
      '/tmp/create-vibe-start.tgz',
      '--skip-github',
    ])
  })
})
