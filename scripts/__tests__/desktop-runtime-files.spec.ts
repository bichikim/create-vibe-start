import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {afterEach, describe, expect, it} from 'vitest'
import {copyGithubCliBinary, githubCliBinaryPaths} from '../desktop-runtime-files'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {force: true, recursive: true})))
})

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), 'desktop-runtime-'))
  temporaryDirectories.push(directory)
  return directory
}

describe('githubCliBinaryPaths', () => {
  it('uses the flat Windows archive layout', () => {
    expect(githubCliBinaryPaths('extract', 'runtime', 'gh_2.95.0_windows_amd64', 'windows_amd64')).toEqual({
      source: path.join('extract', 'bin', 'gh.exe'),
      destination: path.join('runtime', 'gh.exe'),
    })
  })

  it('uses the root directory in macOS archives', () => {
    expect(githubCliBinaryPaths('extract', 'runtime', 'gh_2.95.0_macOS_arm64', 'macOS_arm64')).toEqual({
      source: path.join('extract', 'gh_2.95.0_macOS_arm64', 'bin', 'gh'),
      destination: path.join('runtime', 'gh'),
    })
  })
})

describe('copyGithubCliBinary', () => {
  it.each([
    ['windows_amd64', path.join('bin', 'gh.exe'), 'gh.exe'],
    ['macOS_amd64', path.join('gh_2.95.0_macOS_amd64', 'bin', 'gh'), 'gh'],
  ])('copies the %s binary using native paths', async (platform, sourcePath, destinationName) => {
    const root = await temporaryDirectory()
    const extractDir = path.join(root, 'extract')
    const destination = path.join(root, 'runtime')
    const archiveName = `gh_2.95.0_${platform}`
    const source = path.join(extractDir, sourcePath)
    await mkdir(path.dirname(source), {recursive: true})
    await mkdir(destination, {recursive: true})
    await writeFile(source, platform)

    await copyGithubCliBinary(extractDir, destination, archiveName, platform)

    await expect(readFile(path.join(destination, destinationName), 'utf8')).resolves.toBe(platform)
  })
})
