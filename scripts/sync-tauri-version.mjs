import {readFile, writeFile} from 'node:fs/promises'

const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
const tauriConfig = JSON.parse(await readFile('src-tauri/tauri.conf.json', 'utf8'))
tauriConfig.version = packageJson.version
await writeFile('src-tauri/tauri.conf.json', `${JSON.stringify(tauriConfig, null, 2)}\n`)

const cargoPath = 'src-tauri/Cargo.toml'
const cargo = await readFile(cargoPath, 'utf8')
const nextCargo = cargo.replace(
  /(?<prefix>\[package\][\s\S]*?\nversion\s*=\s*)"[^"]+"/u,
  `$<prefix>"${packageJson.version}"`,
)
if (nextCargo === cargo && !cargo.includes(`version = "${packageJson.version}"`)) {
  throw new Error('Unable to update src-tauri/Cargo.toml package version.')
}
await writeFile(cargoPath, nextCargo)
