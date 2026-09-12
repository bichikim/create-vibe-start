import {readdir, readFile, writeFile} from 'node:fs/promises'
import {basename, join} from 'node:path'

const [artifactDir, tag, repository, outputFile = 'latest.json'] = process.argv.slice(2)
if (!artifactDir || !tag || !repository) {
  throw new Error('Usage: create-updater-manifest.mjs <artifact-dir> <tag> <repository> [output]')
}

async function filesRecursively(directory) {
  const entries = await readdir(directory, {withFileTypes: true})
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const path = join(directory, entry.name)
        if (entry.isDirectory()) {
          return await filesRecursively(path)
        }
        return [path]
      }),
    )
  ).flat()
}

const files = await filesRecursively(artifactDir)
const macOSArtifact = files.find((file) => file.endsWith('.app.tar.gz'))
const updaterArtifacts = {
  'darwin-aarch64': macOSArtifact,
  'darwin-x86_64': macOSArtifact,
  'windows-x86_64': files.find((file) => file.endsWith('.nsis.zip')),
}
const platforms = Object.fromEntries(
  await Promise.all(
    Object.entries(updaterArtifacts).map(async ([platform, artifact]) => {
      if (!artifact) {
        throw new Error(`Missing updater artifact for ${platform}.`)
      }
      return [
        platform,
        {
          signature: (await readFile(`${artifact}.sig`, 'utf8')).trim(),
          url: `https://github.com/${repository}/releases/download/${tag}/${basename(artifact)}`,
        },
      ]
    }),
  ),
)

const manifest = {
  version: tag.replace(/^v/u, ''),
  notes: `Vibe Start ${tag}`,
  ['pub_date']: new Date().toISOString(),
  platforms,
}
await writeFile(outputFile, `${JSON.stringify(manifest, null, 2)}\n`)
