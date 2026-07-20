#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:?Usage: prepare-desktop-runtime.sh <darwin-universal|darwin-arm64|darwin-x64|windows-x64>}"
cd "$(dirname "${BASH_SOURCE[0]}")/.."
MANIFEST="desktop/toolchain.json"
RUNTIME_DIR="src-tauri/runtime"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TEMP_DIR}"' EXIT

NODE_VERSION="$(node -p "require('./${MANIFEST}').node")"
GH_VERSION="$(node -p "require('./${MANIFEST}').gh")"
CHECKSUM_PAIRS=()

download() {
  curl --fail --location --retry 3 --silent --show-error "$1" --output "$2"
}

expected_checksum() {
  local checksums="$1"
  local filename="$2"
  awk -v filename="${filename}" '$2 == filename || $2 == "*" filename {print $1}' "${checksums}"
}

verify_archive() {
  local archive="$1"
  local expected="$2"
  local actual
  if command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 "${archive}" | awk '{print $1}')"
  else
    actual="$(sha256sum "${archive}" | awk '{print $1}')"
  fi
  if [ -z "${expected}" ] || [ "${actual}" != "${expected}" ]; then
    echo "Checksum mismatch for $(basename "${archive}")" >&2
    exit 1
  fi
  CHECKSUM_PAIRS+=("$(basename "${archive}")=${actual}")
}

prepare_node() {
  local platform="$1"
  local archive_name="node-v${NODE_VERSION}-${platform}"
  local extension="tar.gz"
  if [[ "${platform}" == win-* ]]; then extension="zip"; fi
  local archive="${TEMP_DIR}/${archive_name}.${extension}"
  local checksums="${TEMP_DIR}/node-checksums.txt"
  download "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt" "${checksums}"
  download "https://nodejs.org/dist/v${NODE_VERSION}/$(basename "${archive}")" "${archive}"
  verify_archive "${archive}" "$(expected_checksum "${checksums}" "$(basename "${archive}")")"
  rm -rf "${RUNTIME_DIR}/node"
  mkdir -p "${RUNTIME_DIR}/node"
  if [[ "${extension}" == zip ]]; then
    unzip -q "${archive}" -d "${TEMP_DIR}/node-extract"
    cp -R "${TEMP_DIR}/node-extract/${archive_name}/." "${RUNTIME_DIR}/node/"
  else
    tar -xzf "${archive}" --strip-components=1 -C "${RUNTIME_DIR}/node"
  fi
  rm -f "${RUNTIME_DIR}/node/CHANGELOG.md" "${RUNTIME_DIR}/node/README.md"
  rm -rf "${RUNTIME_DIR}/node/include" "${RUNTIME_DIR}/node/share"
  if [[ "${platform}" == win-* ]]; then
    rm -f "${RUNTIME_DIR}/node/corepack"* "${RUNTIME_DIR}/node/npm"* "${RUNTIME_DIR}/node/npx"*
  else
    rm -f "${RUNTIME_DIR}/node/bin/corepack" "${RUNTIME_DIR}/node/bin/npm" "${RUNTIME_DIR}/node/bin/npx"
  fi
}

download_gh() {
  local platform="$1"
  local destination="$2"
  local archive_name="gh_${GH_VERSION}_${platform}"
  local extension="zip"
  local archive="${TEMP_DIR}/${archive_name}.${extension}"
  local checksums="${TEMP_DIR}/gh-checksums.txt"
  if [ ! -f "${checksums}" ]; then
    download "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_checksums.txt" "${checksums}"
  fi
  download "https://github.com/cli/cli/releases/download/v${GH_VERSION}/$(basename "${archive}")" "${archive}"
  verify_archive "${archive}" "$(expected_checksum "${checksums}" "$(basename "${archive}")")"
  mkdir -p "${destination}"
  local extract_dir="${TEMP_DIR}/${archive_name}"
  unzip -q "${archive}" -d "${extract_dir}"
  node "scripts/copy-desktop-runtime-binary.js" "${extract_dir}" "${destination}" "${archive_name}" "${platform}"
}

rm -rf "${RUNTIME_DIR}/node" "${RUNTIME_DIR}/gh"
mkdir -p "${RUNTIME_DIR}"

case "${TARGET}" in
  darwin-arm64)
    prepare_node "darwin-arm64"
    download_gh "macOS_arm64" "${RUNTIME_DIR}/gh"
    ;;
  darwin-x64)
    prepare_node "darwin-x64"
    download_gh "macOS_amd64" "${RUNTIME_DIR}/gh"
    ;;
  darwin-universal)
    prepare_node "darwin-arm64"
    cp "${RUNTIME_DIR}/node/bin/node" "${TEMP_DIR}/node-arm64"
    download_gh "macOS_arm64" "${TEMP_DIR}/gh-arm64"
    prepare_node "darwin-x64"
    lipo -create "${TEMP_DIR}/node-arm64" "${RUNTIME_DIR}/node/bin/node" -output "${RUNTIME_DIR}/node/bin/node-universal"
    mv "${RUNTIME_DIR}/node/bin/node-universal" "${RUNTIME_DIR}/node/bin/node"
    download_gh "macOS_amd64" "${TEMP_DIR}/gh-amd64"
    mkdir -p "${RUNTIME_DIR}/gh"
    lipo -create "${TEMP_DIR}/gh-arm64/gh" "${TEMP_DIR}/gh-amd64/gh" -output "${RUNTIME_DIR}/gh/gh"
    chmod +x "${RUNTIME_DIR}/node/bin/node" "${RUNTIME_DIR}/gh/gh"
    ;;
  windows-x64)
    prepare_node "win-x64"
    download_gh "windows_amd64" "${RUNTIME_DIR}/gh"
    ;;
  *)
    echo "Unsupported desktop runtime target: ${TARGET}" >&2
    exit 1
    ;;
esac

node "scripts/write-toolchain-checksums.mjs" "${MANIFEST}" "${CHECKSUM_PAIRS[@]}"
