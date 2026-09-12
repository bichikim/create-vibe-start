import {readFile} from 'node:fs/promises'

const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
const platform = process.env.DESKTOP_PLATFORM
const publicKey = process.env.TAURI_UPDATER_PUBLIC_KEY
if (!publicKey) {
  throw new Error('TAURI_UPDATER_PUBLIC_KEY is required.')
}

const config = {
  version: packageJson.version,
  bundle: {createUpdaterArtifacts: true},
  plugins: {
    updater: {
      pubkey: publicKey,
      endpoints: ['https://github.com/bichikim/create-vibe-start/releases/latest/download/latest.json'],
    },
  },
}

if (platform === 'windows') {
  const certificateThumbprint = process.env.WINDOWS_CERT_THUMBPRINT
  if (!certificateThumbprint) {
    throw new Error('WINDOWS_CERT_THUMBPRINT is required.')
  }
  config.bundle.windows = {
    certificateThumbprint,
    digestAlgorithm: 'sha256',
    timestampUrl: 'http://timestamp.digicert.com',
  }
}

process.stdout.write(JSON.stringify(config))
