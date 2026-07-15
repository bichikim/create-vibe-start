#!/usr/bin/env node
import {spawnSync} from 'node:child_process'
import {readFileSync, writeFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)))
const appDir = process.cwd()
const withAndroidScript = join(packageDir, 'scripts/with-android.mjs')
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

function validateAppId(appId) {
  if (!/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/u.test(appId)) {
    fail('App ID must use lowercase reverse-domain notation, for example: com.example.myapp')
  }
}

function replaceInFile(path, replacements) {
  let content = readFileSync(path, 'utf8')

  for (const [pattern, replacement] of replacements) {
    content = content.replace(pattern, replacement)
  }

  writeFileSync(path, content)
}

function setAppId(appId) {
  validateAppId(appId)

  replaceInFile(join(appDir, 'capacitor.config.ts'), [
    [/appId: '[^']+'/u, `appId: '${appId}'`],
  ])
  replaceInFile(join(appDir, 'android/app/build.gradle'), [
    [/namespace = "[^"]+"/u, `namespace = "${appId}"`],
    [/applicationId "[^"]+"/u, `applicationId "${appId}"`],
  ])
  replaceInFile(join(appDir, 'android/app/src/main/AndroidManifest.xml'), [
    [/android:name="[^"]+\.MainActivity"/u, `android:name="${appId}.MainActivity"`],
  ])
  replaceInFile(join(appDir, 'android/app/src/main/java/com/vibestart/app/MainActivity.java'), [
    [/package [^;]+;/u, `package ${appId};`],
  ])
  replaceInFile(join(appDir, 'android/app/src/main/res/values/strings.xml'), [
    [/<string name="package_name">[^<]+<\/string>/u, `<string name="package_name">${appId}</string>`],
    [/<string name="custom_url_scheme">[^<]+<\/string>/u, `<string name="custom_url_scheme">${appId}</string>`],
  ])
  replaceInFile(join(appDir, 'ios/App/App.xcodeproj/project.pbxproj'), [
    [/PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/gu, `PRODUCT_BUNDLE_IDENTIFIER = ${appId};`],
  ])

  console.log(`Updated native app ID to ${appId}`)
}

function buildIos() {
  run('vite', ['build', '--config', 'vite.mobile.config.ts', '--mode', 'mobile'])
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
  run('vite', ['build', '--config', 'vite.mobile.config.ts', '--mode', 'mobile'])
  run('cap', ['sync', 'android'])
  run('node', [withAndroidScript, './gradlew', 'assembleDebug'], {cwd: join(appDir, 'android')})
}

if (command === 'app-id' && target) {
  setAppId(target)
} else if (command === 'build' && target === 'ios') {
  buildIos()
} else if (command === 'build' && target === 'android') {
  buildAndroid()
} else if (command === 'build') {
  fail(`Unknown build target: ${target}`)
} else {
  fail('Usage: vite-capacitor <build <ios|android>|app-id <com.example.app>>')
}
