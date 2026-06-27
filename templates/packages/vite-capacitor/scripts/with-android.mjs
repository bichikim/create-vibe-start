import {spawnSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import {delimiter, join} from 'node:path'

const [, , command, ...args] = process.argv
const sdkDir = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
const platformToolsDir = sdkDir ? join(sdkDir, 'platform-tools') : undefined
const emulatorDir = sdkDir ? join(sdkDir, 'emulator') : undefined
const env = {
  ...process.env,
  ...(sdkDir ? {ANDROID_HOME: sdkDir, ANDROID_SDK_ROOT: sdkDir} : {}),
  PATH: [platformToolsDir, emulatorDir, process.env.PATH].filter(Boolean).join(delimiter),
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
  fail('Usage: node scripts/with-android.mjs <command> [...args]')
}

if (!sdkDir) {
  fail(`Android SDK was not found.

Install Android Studio, open it once, and install the Android SDK.

Then set ANDROID_HOME to your Android SDK path before running this Android command:

export ANDROID_HOME=$HOME/Library/Android/sdk`)
}

if (!existsSync(sdkDir)) {
  fail(`Android SDK was not found at ${sdkDir}.

Open Android Studio and install the Android SDK.

If the SDK is installed somewhere else, set ANDROID_HOME:

export ANDROID_HOME=/path/to/Android/sdk`)
}

if (!canRun('adb', ['version'])) {
  fail(`Android SDK Platform-Tools were not found.

The Android commands use ANDROID_HOME=${sdkDir}

Open Android Studio, then install Android SDK Platform-Tools from:

Settings > Languages & Frameworks > Android SDK > SDK Tools

After setup finishes, run this Android command again.`)
}

run()
