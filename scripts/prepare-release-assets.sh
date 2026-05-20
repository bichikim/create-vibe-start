#!/usr/bin/env bash
set -euo pipefail

DIST_TAG="${1:?npm dist-tag label: latest or alpha}"
OUT_DIR="${2:-release-assets}"

PACKAGE_VERSION="$(node -p "require('./package.json').version")"
NPM_CREATE_SPEC="vibe-start@${PACKAGE_VERSION}"

NODE_VERSION="$(curl -fsSL https://nodejs.org/dist/index.json | node -e "
const chunks = []
process.stdin.on('data', (chunk) => chunks.push(chunk))
process.stdin.on('end', () => {
  const entries = JSON.parse(Buffer.concat(chunks).toString())
  const versions = entries
    .map((entry) => entry.version.replace(/^v/, ''))
    .filter((version) => /^22\\./.test(version))
  versions.sort((left, right) => {
    const a = left.split('.').map(Number)
    const b = right.split('.').map(Number)
    for (let i = 0; i < 3; i += 1) {
      if (a[i] !== b[i]) return a[i] - b[i]
    }
    return 0
  })
  const latest = versions[versions.length - 1]
  if (!latest) {
    console.error('No Node.js 22.x release found on nodejs.org')
    process.exit(1)
  }
  process.stdout.write(latest)
})
")"

mkdir -p "$OUT_DIR"
for asset in install.sh install.ps1; do
  sed \
    -e "s/__NPM_CREATE_SPEC__/${NPM_CREATE_SPEC}/g" \
    -e "s/__NODE_VERSION__/${NODE_VERSION}/g" \
    -e "s/__CREATE_VIBE_START_VERSION__/${PACKAGE_VERSION}/g" \
    "scripts/${asset}" >"${OUT_DIR}/${asset}"
done
chmod +x "$OUT_DIR/install.sh"

checksum_cmd() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$@"
  else
    shasum -a 256 "$@"
  fi
}

(
  cd "$OUT_DIR"
  checksum_cmd install.sh install.ps1 >SHA256SUMS
)

echo "Release assets (${DIST_TAG}):"
echo "  package: ${PACKAGE_VERSION}"
echo "  npm: ${NPM_CREATE_SPEC}"
echo "  node: v${NODE_VERSION}"
ls -la "$OUT_DIR"
cat "$OUT_DIR/SHA256SUMS"
