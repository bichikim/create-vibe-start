import {existsSync} from 'node:fs'
import {spawnSync} from 'node:child_process'

const defaultDeveloperDir = '/Applications/Xcode.app/Contents/Developer'
const [, , mode] = process.argv
const developerDir = process.env.DEVELOPER_DIR || defaultDeveloperDir
const env = {
  ...process.env,
  DEVELOPER_DIR: developerDir,
}

function fail(message) {
  console.error(`\n${message}\n`)
  process.exit(1)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env,
    ...options,
  })

  if (result.error) {
    fail(result.error.message)
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function canRun(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'pipe',
    env,
    encoding: 'utf8',
  })

  return result.status === 0
}

function checkIosToolchain() {
  if (process.platform !== 'darwin') {
    fail('iOS commands require macOS.')
  }

  if (!existsSync(developerDir)) {
    fail(`Xcode was not found at ${developerDir}.

Install Xcode from the App Store, or set DEVELOPER_DIR:

export DEVELOPER_DIR=/path/to/Xcode.app/Contents/Developer`)
  }

  if (!canRun('xcrun', ['--find', 'simctl'])) {
    fail(`iOS Simulator tools were not found.

The iOS commands use DEVELOPER_DIR=${developerDir}

Install Xcode, then run:

sudo xcodebuild -runFirstLaunch

If Xcode is installed in a custom location, set:

export DEVELOPER_DIR=/path/to/Xcode.app/Contents/Developer`)
  }

  if (!canRun('xcodebuild', ['-version'])) {
    fail(`xcodebuild is not ready.

The iOS commands use DEVELOPER_DIR=${developerDir}

Open Xcode once or run:

sudo xcodebuild -runFirstLaunch`)
  }
}

if (mode !== 'dev' && mode !== 'build') {
  fail('Usage: node scripts/run-ios.mjs <dev|build>')
}

checkIosToolchain()

if (mode === 'dev') {
  env.CAP_SERVER_URL ||= 'http://localhost:3000'
  run('cap', ['run', 'ios'])
} else {
  run('pnpm', ['mobile:build'])
  run('cap', ['sync', 'ios'])
  run('xcodebuild', [
    '-project',
    'ios/App/App.xcodeproj',
    '-scheme',
    'App',
    '-configuration',
    'Debug',
    '-destination',
    'generic/platform=iOS Simulator',
    'build',
  ])
}
