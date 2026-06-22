import {spawnSync} from 'node:child_process'
import {existsSync} from 'node:fs'

const defaultDeveloperDir = '/Applications/Xcode.app/Contents/Developer'
const [, , command, ...args] = process.argv
const developerDir = process.env.DEVELOPER_DIR || defaultDeveloperDir
const env = {
  ...process.env,
  DEVELOPER_DIR: developerDir,
}

function fail(message) {
  console.error(`\n${message}\n`)
  process.exit(1)
}

function canRun(checkCommand, checkArgs) {
  const result = spawnSync(checkCommand, checkArgs, {
    encoding: 'utf8',
    env,
    stdio: 'pipe',
  })

  return result.status === 0
}

function run() {
  const result = spawnSync(command, args, {
    env,
    stdio: 'inherit',
  })

  if (result.error) {
    fail(result.error.message)
  }

  process.exit(result.status ?? 1)
}

if (!command) {
  fail('Usage: node scripts/with-xcode.mjs <command> [...args]')
}

if (process.platform !== 'darwin') {
  fail('iOS commands require macOS.')
}

if (!existsSync(developerDir)) {
  fail(`Xcode was not found at ${developerDir}.

Install Xcode from the App Store, then run this iOS command again.

If Xcode is already installed in a custom location, set DEVELOPER_DIR:

export DEVELOPER_DIR=/path/to/Xcode.app/Contents/Developer`)
}

if (!canRun('xcrun', ['--find', 'simctl'])) {
  fail(`iOS Simulator tools were not found.

The iOS commands use DEVELOPER_DIR=${developerDir}

Install Xcode, then run:

sudo xcodebuild -runFirstLaunch

After setup finishes, run this iOS command again.

If Xcode is installed in a custom location, set:

export DEVELOPER_DIR=/path/to/Xcode.app/Contents/Developer`)
}

if (!canRun('xcodebuild', ['-version'])) {
  fail(`xcodebuild is not ready.

The iOS commands use DEVELOPER_DIR=${developerDir}

Open Xcode once or run:

sudo xcodebuild -runFirstLaunch

After setup finishes, run this iOS command again.`)
}

run()
