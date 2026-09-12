import {copyFile} from 'node:fs/promises'
import path from 'node:path'

/**
 * @param {string} extractDir
 * @param {string} destination
 * @param {string} archiveName
 * @param {string} platform
 */
export function githubCliBinaryPaths(extractDir, destination, archiveName, platform) {
  const windows = platform.startsWith('windows_')
  return {
    source: windows ? path.join(extractDir, 'bin', 'gh.exe') : path.join(extractDir, archiveName, 'bin', 'gh'),
    destination: path.join(destination, windows ? 'gh.exe' : 'gh'),
  }
}

/**
 * @param {string} extractDir
 * @param {string} destination
 * @param {string} archiveName
 * @param {string} platform
 */
export async function copyGithubCliBinary(extractDir, destination, archiveName, platform) {
  const paths = githubCliBinaryPaths(extractDir, destination, archiveName, platform)
  await copyFile(paths.source, paths.destination)
}
