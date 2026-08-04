#!/usr/bin/env node
import {spawnSync} from 'node:child_process'
import {existsSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)))
const appDir = process.cwd()
const withAndroidScript = join(packageDir, 'scripts/with-android.mjs')
const [, , command, firstArgument, secondArgument] = process.argv

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

function setConfigAppId(appId) {
  replaceInFile(join(appDir, 'capacitor.config.ts'), [[/appId: '[^']+'/u, `appId: '${appId}'`]])
}

function setAndroidAppId(appId) {
  validateAppId(appId)
  setConfigAppId(appId)
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
  updateCodemagicId('PACKAGE_NAME', appId)

  console.log(`Updated Android package name to ${appId}`)
}

function setIosAppId(appId) {
  validateAppId(appId)
  setConfigAppId(appId)
  replaceInFile(join(appDir, 'ios/App/App.xcodeproj/project.pbxproj'), [
    [/PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/gu, `PRODUCT_BUNDLE_IDENTIFIER = ${appId};`],
  ])
  updateCodemagicId('bundle_identifier', appId)

  console.log(`Updated iOS bundle ID to ${appId}`)
}

function setAppId(appId) {
  setAndroidAppId(appId)
  setIosAppId(appId)

  console.log(`Updated native app ID to ${appId}`)
}

function updateCodemagicId(key, appId) {
  const codemagicPath = join(appDir, '..', '..', 'codemagic.yaml')
  if (!existsSync(codemagicPath)) {
    return
  }

  const pattern = key === 'PACKAGE_NAME' ? /PACKAGE_NAME: "[^"]+"/u : /bundle_identifier: "[^"]+"/u
  replaceInFile(codemagicPath, [[pattern, `${key}: "${appId}"`]])
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

if (command === 'app-id' && secondArgument && firstArgument === 'ios') {
  setIosAppId(secondArgument)
} else if (command === 'app-id' && secondArgument && firstArgument === 'android') {
  setAndroidAppId(secondArgument)
} else if (command === 'app-id' && firstArgument) {
  setAppId(firstArgument)
} else if (command === 'build' && firstArgument === 'ios') {
  buildIos()
} else if (command === 'build' && firstArgument === 'android') {
  buildAndroid()
} else if (command === 'build') {
  fail(`Unknown build target: ${firstArgument}`)
} else {
  fail('Usage: vite-capacitor <build <ios|android>|app-id [ios|android] <com.example.app>>')
}
