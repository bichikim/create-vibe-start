#!/usr/bin/env bash
set -euo pipefail

NPM_CREATE_SPEC="__NPM_CREATE_SPEC__"
CREATE_VIBE_START_VERSION="__CREATE_VIBE_START_VERSION__"
NODE_VERSION="__NODE_VERSION__"
NODE_MAJOR_MIN=22
PREFIX="${CREATE_VIBE_START_PREFIX:-${HOME}/.local}"

err() {
  echo "create-vibe-start install: $*" >&2
  exit 1
}

node_major_version() {
  if ! command -v node >/dev/null 2>&1; then
    echo 0
    return
  fi
  node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || echo 0
}

node_ok() {
  local major
  major="$(node_major_version)"
  [ "$major" -ge "$NODE_MAJOR_MIN" ]
}

detect_linux_arch() {
  case "$(uname -m)" in
    x86_64) echo "x64" ;;
    aarch64 | arm64) echo "arm64" ;;
    *) err "Unsupported Linux architecture: $(uname -m)" ;;
  esac
}

install_node_linux() {
  local arch tarball url tmp
  arch="$(detect_linux_arch)"
  tarball="node-v${NODE_VERSION}-linux-${arch}.tar.xz"
  url="https://nodejs.org/dist/v${NODE_VERSION}/${tarball}"
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT

  echo "Downloading Node.js v${NODE_VERSION} (${arch}) from nodejs.org..."
  curl -fsSL "$url" -o "${tmp}/${tarball}"
  mkdir -p "${PREFIX}"
  tar -xJf "${tmp}/${tarball}" -C "${PREFIX}" --strip-components=1

  export PATH="${PREFIX}/bin:${PATH}"

  if ! command -v node >/dev/null 2>&1; then
    err "Node was extracted to ${PREFIX}/bin but is not on PATH. Run: export PATH=\"${PREFIX}/bin:\$PATH\""
  fi

  echo "Node.js $(node -v) installed under ${PREFIX}"
  echo "Add to your shell profile: export PATH=\"${PREFIX}/bin:\$PATH\""
}

install_node() {
  case "$(uname -s)" in
    Darwin)
      command -v brew >/dev/null 2>&1 || err "Install Homebrew, then: brew install node"
      brew install node
      ;;
    Linux)
      install_node_linux
      ;;
    *)
      err "Unsupported OS. Install Node.js ${NODE_MAJOR_MIN}+ from https://nodejs.org"
      ;;
  esac
}

main() {
  if ! node_ok; then
    echo "Node.js ${NODE_MAJOR_MIN}+ is required."
    install_node
  fi

  if ! node_ok; then
    err "Node.js ${NODE_MAJOR_MIN}+ still not available after install."
  fi

  if ! command -v npm >/dev/null 2>&1; then
    err "npm not found (expected with Node.js)."
  fi

  echo "Starting create-vibe-start ${CREATE_VIBE_START_VERSION} (${NPM_CREATE_SPEC})..."
  exec npm create "${NPM_CREATE_SPEC}" "$@"
}

main "$@"
