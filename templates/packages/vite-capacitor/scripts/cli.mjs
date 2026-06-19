#!/usr/bin/env node
import {spawnSync} from 'node:child_process'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)))
const appDir = process.cwd()
const [, , command, target] = process.argv

function fail(message) {
  console.error(`\n${message}\n`)
  process.exit(1)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: appDir,
    env: process.env,
    stdio: 'inherit',
    ...options,
  })

  if (result.error) {
    fail(result.error.message)
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function buildIos() {
  run('vite', ['build', '--config', 'vite.mobile.config.ts'])
  run('cap', ['sync', 'ios'])
  run('node', [
    join(packageDir, 'scripts/with-xcode.mjs'),
    'xcodebuild',
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

function buildAndroid() {
  run('vite', ['build', '--config', 'vite.mobile.config.ts'])
  run('cap', ['sync', 'android'])
  run('./gradlew', ['assembleDebug'], {cwd: join(appDir, 'android')})
}

if (command !== 'build' || !target) {
  fail('Usage: vite-capacitor build <ios|android>')
}

if (target === 'ios') {
  buildIos()
} else if (target === 'android') {
  buildAndroid()
} else {
  fail(`Unknown build target: ${target}`)
}
