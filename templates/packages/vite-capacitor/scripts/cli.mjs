#!/usr/bin/env node
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

async function run(command, args, options = {}) {
  // app-id는 의존성 설치 전에도 실행할 수 있도록 외부 명령이 필요한 build 경로에서만 Execa를 불러온다.
  const {execa} = await import('execa')
  const result = await execa(command, args, {
    cwd: appDir,
    env: process.env,
    reject: false,
    stdio: 'inherit',
    ...options,
  })

  if (result.failed) {
    process.exit(result.exitCode ?? 1)
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
  // Capacitor, Gradle, AndroidManifest, Java package를 한 번에 바꿔 네이티브 식별자를 일치시킨다.
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
  // iOS만 선택한 경우 Android 식별자는 유지하고 Capacitor와 Xcode 설정만 갱신한다.
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
    // 이 도구를 Codemagic 템플릿이 없는 프로젝트에서도 사용할 수 있게 선택 파일로 취급한다.
    return
  }

  const pattern = key === 'PACKAGE_NAME' ? /PACKAGE_NAME: "[^"]+"/u : /bundle_identifier: "[^"]+"/u
  replaceInFile(codemagicPath, [[pattern, `${key}: "${appId}"`]])
}

async function buildIos() {
  await run('vite', ['build', '--config', 'vite.mobile.config.ts', '--mode', 'mobile'])
  await run('cap', ['sync', 'ios'])
  await run('node', [
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

async function buildAndroid() {
  await run('vite', ['build', '--config', 'vite.mobile.config.ts', '--mode', 'mobile'])
  await run('cap', ['sync', 'android'])
  await run('node', [withAndroidScript, './gradlew', 'assembleDebug'], {cwd: join(appDir, 'android')})
}

if (command === 'app-id' && secondArgument && firstArgument === 'ios') {
  setIosAppId(secondArgument)
} else if (command === 'app-id' && secondArgument && firstArgument === 'android') {
  setAndroidAppId(secondArgument)
} else if (command === 'app-id' && firstArgument) {
  setAppId(firstArgument)
} else if (command === 'build' && firstArgument === 'ios') {
  await buildIos()
} else if (command === 'build' && firstArgument === 'android') {
  await buildAndroid()
} else if (command === 'build') {
  fail(`Unknown build target: ${firstArgument}`)
} else {
  fail('Usage: vite-capacitor <build <ios|android>|app-id [ios|android] <com.example.app>>')
}
