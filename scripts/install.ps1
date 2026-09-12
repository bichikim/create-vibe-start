#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$NpmCreateSpec = "__NPM_CREATE_SPEC__"
$CreateVibeStartVersion = "__CREATE_VIBE_START_VERSION__"
$NodeMajorMin = 22

function Get-NodeMajor {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    return 0
  }
  return [int](node -p "process.versions.node.split('.')[0]")
}

function Install-Node {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw "Install Node.js ${NodeMajorMin}+ from https://nodejs.org (winget not found)."
  }
  winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
}

function Refresh-Path {
  $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $user = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machine;$user"
}

if ((Get-NodeMajor) -lt $NodeMajorMin) {
  Write-Host "Node.js ${NodeMajorMin}+ is required."
  Install-Node
  Refresh-Path
}

if ((Get-NodeMajor) -lt $NodeMajorMin) {
  throw "Node.js ${NodeMajorMin}+ still not available after install."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm not found (expected with Node.js)."
}

Write-Host "Starting create-vibe-start ${CreateVibeStartVersion} (${NpmCreateSpec})..."
npm create "$NpmCreateSpec" @args
