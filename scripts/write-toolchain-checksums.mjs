import {readFile, writeFile} from 'node:fs/promises'

const [manifestPath, ...pairs] = process.argv.slice(2)
if (!manifestPath || pairs.some((pair) => !pair.includes('='))) {
  throw new Error('Usage: write-toolchain-checksums.mjs <manifest> <artifact=sha256>...')
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
manifest.checksums = Object.fromEntries(
  pairs.map((pair) => {
    const separator = pair.indexOf('=')
    return [pair.slice(0, separator), pair.slice(separator + 1)]
  }),
)
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
