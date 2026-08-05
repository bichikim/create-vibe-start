import {execFile} from 'node:child_process'
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {promisify} from 'node:util'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import packageJson from '../../../package.json'

const logStepMock = vi.fn()
const logMessageMock = vi.fn()
const execFileAsync = promisify(execFile)

vi.mock('@clack/prompts', () => ({
  log: {
    step: logStepMock,
    message: logMessageMock,
  },
}))

describe('resolveDefaultTemplateDir', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses repo-root templates in development', async () => {
    const {resolveDefaultTemplateDir} = await import('../generate-template')

    expect(resolveDefaultTemplateDir('file:///repo/src/steps/generate-template.ts')).toBe('/repo/templates')
  })

  it('uses the bundled templates directory in production', async () => {
    vi.stubEnv('PROD', true)
    const {resolveDefaultTemplateDir} = await import('../generate-template')

    expect(resolveDefaultTemplateDir('file:///repo/dist/cli.js')).toBe('/repo/dist/templates')
  })
})

describe('generateTemplate', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'create-vibe-start-'))
    logStepMock.mockReset()
    logMessageMock.mockReset()
  })

  afterEach(async () => {
    await rm(testDir, {recursive: true, force: true})
  })

  it('uses the manifest from path when to is omitted', async () => {
    const projectDir = join(testDir, 'project')
    const {generateTemplate} = await import('../generate-template')

    await generateTemplate(projectDir)

    await expect(readFile(join(projectDir, 'README.md'), 'utf8')).resolves.toContain('Nitro, Vue, oRPC, Zod, Drizzle')
    await expect(readFile(join(projectDir, 'README.md'), 'utf8')).resolves.toContain(
      '[배포 설정 사용 설명서](docs/deployment-setup.md)',
    )
    await expect(readFile(join(projectDir, 'docs/deployment-setup.md'), 'utf8')).resolves.toContain(
      'CODEMAGIC_API_TOKEN',
    )
    await expect(readFile(join(projectDir, 'package.json'), 'utf8')).resolves.toContain('@vibe-start-app/main-app')
    await expect(readFile(join(projectDir, 'pnpm-workspace.yaml'), 'utf8')).resolves.toContain('catalog:')
    await expect(readFile(join(projectDir, 'apps/main-app/.env.example'), 'utf8')).resolves.toContain(
      'TURSO_DATABASE_URL=file:./data/app.db',
    )
    await expect(readFile(join(projectDir, 'apps/main-app/package.json'), 'utf8')).resolves.toContain(
      '"drizzle-orm": "catalog:"',
    )
    await expect(readFile(join(projectDir, 'apps/main-app/package.json'), 'utf8')).resolves.toContain(
      '"tailwindcss": "catalog:"',
    )
    await expect(readFile(join(projectDir, 'apps/main-app/package.json'), 'utf8')).resolves.toContain(
      '"class-variance-authority": "catalog:"',
    )
    await expect(readFile(join(projectDir, 'apps/main-app/package.json'), 'utf8')).resolves.toContain(
      '"@pinia/colada": "catalog:"',
    )
    await expect(readFile(join(projectDir, 'apps/main-app/package.json'), 'utf8')).resolves.toContain(
      '"pinia": "catalog:"',
    )
    await expect(readFile(join(projectDir, 'apps/main-app/package.json'), 'utf8')).resolves.toContain(
      '"reka-ui": "catalog:"',
    )
    await expect(readFile(join(projectDir, 'apps/main-app/package.json'), 'utf8')).resolves.toContain(
      '"stripe": "catalog:"',
    )
    await expect(readFile(join(projectDir, 'apps/main-app/package.json'), 'utf8')).resolves.toContain(
      '"vue-router": "catalog:"',
    )
    await expect(readFile(join(projectDir, 'apps/main-app/src/App.vue'), 'utf8')).resolves.toContain('<RouterView />')
    await expect(readFile(join(projectDir, 'apps/main-app/src/App.vue'), 'utf8')).resolves.toContain('Billing')
    await expect(readFile(join(projectDir, 'apps/main-app/src/router.ts'), 'utf8')).resolves.toContain(
      "path: '/billing'",
    )
    await expect(readFile(join(projectDir, 'apps/main-app/src/views/BillingView.vue'), 'utf8')).resolves.toContain(
      'Vibe Start Sticker Pack',
    )
    await expect(readFile(join(projectDir, 'apps/main-app/src/views/NotesView.vue'), 'utf8')).resolves.toContain(
      "import {useMutation, useQuery, useQueryCache} from '@pinia/colada'",
    )
    await expect(readFile(join(projectDir, 'apps/main-app/src/views/NotesView.vue'), 'utf8')).resolves.toContain(
      "import AppDialog from '../components/ui/AppDialog.vue'",
    )
    await expect(
      readFile(join(projectDir, 'apps/main-app/src/components/ui/AppDialog.vue'), 'utf8'),
    ).resolves.toContain('{{ title }}')
    await expect(readFile(join(projectDir, 'apps/main-app/vite.config.ts'), 'utf8')).resolves.toContain('tailwindcss')
    await expect(readFile(join(projectDir, 'apps/main-app/src/style.css'), 'utf8')).resolves.toContain(
      '@import "tailwindcss";',
    )
    await expect(readFile(join(projectDir, 'apps/main-app/src/style.css'), 'utf8')).resolves.toContain('.safe-page')
    await expect(readFile(join(projectDir, 'apps/main-app/index.html'), 'utf8')).resolves.toContain(
      'viewport-fit=cover',
    )
    await expect(readFile(join(projectDir, 'apps/main-app/drizzle.config.ts'), 'utf8')).resolves.toContain(
      "dialect: 'turso'",
    )
    await expect(readFile(join(projectDir, 'apps/main-app/vercel.json'), 'utf8')).resolves.toContain(
      '"buildCommand": "pnpm db:migrate && pnpm build"',
    )
    await expect(readFile(join(projectDir, 'apps/main-app/server/env.ts'), 'utf8')).resolves.toContain(
      'STRIPE_SECRET_KEY',
    )
    await expect(readFile(join(projectDir, 'apps/main-app/server/rpc/router.ts'), 'utf8')).resolves.toContain(
      "['allowed_countries']: ['KR']",
    )
    await expect(
      readFile(join(projectDir, 'apps/main-app/server/routes/api/stripe/webhook.post.ts'), 'utf8'),
    ).resolves.toContain('constructEvent')
    await expect(readFile(join(projectDir, 'codemagic.yaml'), 'utf8')).resolves.toContain('android-release:')
    await expect(readFile(join(projectDir, 'vercel.json'), 'utf8')).rejects.toThrow()
    expect(logStepMock).toHaveBeenCalledWith('프로젝트 템플릿 생성')
    expect(logMessageMock).toHaveBeenCalledWith(`템플릿 파일 생성 완료: ${projectDir}`)
  })

  it('overwrites an existing README.md file', async () => {
    const projectDir = join(testDir, 'project')
    await mkdir(projectDir)
    await writeFile(join(projectDir, 'README.md'), '# existing\n')
    const {generateTemplate} = await import('../generate-template')

    await generateTemplate(projectDir)

    await expect(readFile(join(projectDir, 'README.md'), 'utf8')).resolves.toContain('vibe-start-app')
  })

  it('applies the selected project name to README and package files', async () => {
    const projectDir = join(testDir, 'project')
    const {generateTemplate} = await import('../generate-template')

    await generateTemplate(projectDir, {projectName: 'my-app'})

    const readme = await readFile(join(projectDir, 'README.md'), 'utf8')
    const rootPackageJson = JSON.parse(await readFile(join(projectDir, 'package.json'), 'utf8')) as {
      name: string
      scripts: Record<string, string>
      devDependencies: Record<string, string>
    }
    const appPackageJson = JSON.parse(await readFile(join(projectDir, 'apps/main-app/package.json'), 'utf8')) as {
      name: string
      scripts: Record<string, string>
      dependencies: Record<string, string>
      devDependencies: Record<string, string>
    }

    expect(readme.startsWith('# my-app\n')).toBe(true)
    expect(readme).toContain('pnpm --filter @my-app/main-app db:migrate')
    expect(readme).toContain('Mobile deployment with Codemagic')
    expect(readme).toContain('Stripe merch checkout')
    expect(readme).toContain('VITE_API_URL')
    expect(readme).toContain('Google Play `internal` track')
    expect(readme).toContain('TestFlight')
    expect(appPackageJson.dependencies).toMatchObject({['better-auth']: 'catalog:'})
    expect(appPackageJson.dependencies).toMatchObject({stripe: 'catalog:'})
    expect(rootPackageJson.name).toBe('my-app')
    expect(rootPackageJson.scripts.setup).toBe(`pnpm dlx create-vibe-start@${packageJson.version} setup --dir .`)
    expect(rootPackageJson.devDependencies['create-vibe-start']).toBeUndefined()
    await expect(readFile(join(projectDir, '.vibe-start/create-vibe-start.tgz'))).rejects.toThrow()
    expect(rootPackageJson.scripts.dev).toBe('pnpm --filter @my-app/main-app dev')
    expect(rootPackageJson.scripts['mobile:build']).toBe('pnpm --filter @my-app/main-app mobile:build')
    expect(rootPackageJson.scripts.ios).toBe('pnpm --filter @my-app/main-app ios')
    expect(rootPackageJson.scripts.android).toBe('pnpm --filter @my-app/main-app android')
    expect(rootPackageJson.scripts['ios:dev']).toBe('pnpm --filter @my-app/main-app ios:dev')
    expect(rootPackageJson.scripts['app-id']).toBe('pnpm --filter @my-app/main-app app-id')
    expect(rootPackageJson.scripts['android:build']).toBe('pnpm --filter @my-app/main-app android:build')
    expect(appPackageJson.name).toBe('@my-app/main-app')
    expect(appPackageJson.scripts['mobile:build']).toBe('vite build --config vite.mobile.config.ts --mode mobile')
    expect(appPackageJson.scripts.ios).toBe(
      [
        'node ../../packages/vite-capacitor/scripts/with-xcode.mjs',
        'cap run ios --live-reload --host localhost --port 3000',
      ].join(' '),
    )
    expect(appPackageJson.scripts.android).toBe(
      [
        'node ../../packages/vite-capacitor/scripts/with-android.mjs adb reverse tcp:3000 tcp:3000',
        '&& node ../../packages/vite-capacitor/scripts/with-android.mjs',
        'cap run android --live-reload --host localhost --port 3000',
      ].join(' '),
    )
    expect(appPackageJson.scripts['ios:dev']).toBe('vite --host 0.0.0.0 --port 3000 --mode ios')
    expect(appPackageJson.scripts['android:dev']).toBe('vite --host 0.0.0.0 --port 3000 --mode android')
    expect(appPackageJson.scripts['app-id']).toBe('vite-capacitor app-id')
    expect(appPackageJson.scripts['ios:build']).toBe('vite-capacitor build ios')
    expect(appPackageJson.scripts['android:build']).toBe('vite-capacitor build android')
    await expect(readFile(join(projectDir, 'apps/main-app/src/lib/api-url.ts'), 'utf8')).resolves.toContain(
      'VITE_API_URL',
    )
    await expect(readFile(join(projectDir, 'apps/main-app/vite.mobile.config.ts'), 'utf8')).resolves.toContain(
      'VITE_API_URL is required for mobile production builds.',
    )
    await expect(
      readFile(join(projectDir, 'apps/main-app/android/capacitor.settings.gradle'), 'utf8'),
    ).rejects.toThrow()
    await expect(readFile(join(projectDir, 'apps/main-app/tsconfig.json'), 'utf8')).resolves.toContain(
      '"vite.mobile.config.ts"',
    )
    await expect(readFile(join(projectDir, 'apps/main-app/tsconfig.json'), 'utf8')).resolves.toContain(
      '"capacitor.config.ts"',
    )
    await expect(readFile(join(projectDir, 'apps/main-app/src/lib/auth-client.ts'), 'utf8')).resolves.toContain(
      'baseURL: apiUrl',
    )
    await expect(readFile(join(projectDir, 'apps/main-app/src/orpc.ts'), 'utf8')).resolves.toContain(
      'url: `${apiUrl}/rpc`',
    )
    await expect(readFile(join(projectDir, 'apps/main-app/src/env.d.ts'), 'utf8')).resolves.toContain(
      'readonly VITE_API_URL?: string',
    )
    await expect(readFile(join(projectDir, 'apps/main-app/src/env.d.ts'), 'utf8')).resolves.not.toContain(
      'VITE_BETTER_AUTH_URL',
    )
    expect(appPackageJson.devDependencies).toMatchObject({
      ['vite-capacitor']: 'workspace:*',
    })
    await expect(
      readFile(join(projectDir, 'packages/vite-capacitor/scripts/with-xcode.mjs'), 'utf8'),
    ).resolves.toContain('DEVELOPER_DIR: developerDir')
    await expect(
      readFile(join(projectDir, 'packages/vite-capacitor/scripts/with-xcode.mjs'), 'utf8'),
    ).resolves.toContain('Install Xcode from the App Store, then run this iOS command again.')
    await expect(
      readFile(join(projectDir, 'packages/vite-capacitor/scripts/with-android.mjs'), 'utf8'),
    ).resolves.toContain('Android SDK was not found.')
    await expect(
      readFile(join(projectDir, 'packages/vite-capacitor/scripts/with-android.mjs'), 'utf8'),
    ).resolves.toContain('Android SDK Platform-Tools were not found.')
    await expect(readFile(join(projectDir, 'packages/vite-capacitor/package.json'), 'utf8')).resolves.toContain(
      '"name": "vite-capacitor"',
    )
    await expect(readFile(join(projectDir, 'packages/vite-capacitor/package.json'), 'utf8')).resolves.toContain(
      '"execa": "catalog:"',
    )
    await expect(readFile(join(projectDir, 'packages/vite-capacitor/scripts/cli.mjs'), 'utf8')).resolves.toContain(
      "await import('execa')",
    )
    await expect(readFile(join(projectDir, 'packages/vite-capacitor/scripts/cli.mjs'), 'utf8')).resolves.toContain(
      'lowercase reverse-domain notation',
    )
    await expect(readFile(join(projectDir, 'packages/vite-capacitor/scripts/cli.mjs'), 'utf8')).resolves.toContain(
      'vite-capacitor <build <ios|android>|app-id [ios|android] <com.example.app>>',
    )
    await expect(readFile(join(projectDir, 'packages/vite-capacitor/scripts/cli.mjs'), 'utf8')).resolves.toContain(
      "'--mode', 'mobile'",
    )
    await expect(readFile(join(projectDir, 'packages/vite-capacitor/src/index.ts'), 'utf8')).resolves.toContain(
      'scripts/with-android.mjs',
    )
    await expect(readFile(join(projectDir, 'packages/vite-capacitor/src/index.ts'), 'utf8')).resolves.toContain(
      "'adb', 'reverse'",
    )
    await expect(readFile(join(projectDir, 'packages/vite-capacitor/src/index.ts'), 'utf8')).resolves.toContain(
      "'--host', 'localhost'",
    )
    await expect(readFile(join(projectDir, 'apps/main-app/server/routes/rpc/[...].ts'), 'utf8')).resolves.toContain(
      "'capacitor://localhost'",
    )
    await expect(readFile(join(projectDir, 'apps/main-app/server/auth.ts'), 'utf8')).resolves.toContain(
      "'capacitor://localhost'",
    )
    await expect(readFile(join(projectDir, 'apps/main-app/vite.config.ts'), 'utf8')).resolves.toContain(
      "import {capacitorRun} from 'vite-capacitor'",
    )
    await expect(readFile(join(projectDir, 'apps/main-app/capacitor.config.ts'), 'utf8')).resolves.toContain(
      "appName: 'my-app'",
    )
    await expect(readFile(join(projectDir, 'apps/main-app/capacitor.config.ts'), 'utf8')).resolves.toContain(
      "appId: 'com.vibestart.myapp'",
    )
    const androidBuildGradle = await readFile(join(projectDir, 'apps/main-app/android/app/build.gradle'), 'utf8')
    expect(androidBuildGradle).toContain('applicationId "com.vibestart.myapp"')
    expect(androidBuildGradle).toContain('System.getenv("ANDROID_VERSION_CODE")')
    expect(androidBuildGradle).toContain('System.getenv("BUILD_NUMBER")')
    expect(androidBuildGradle).not.toContain('CM_KEYSTORE_PATH')
    expect(androidBuildGradle).not.toContain('android_keystore')
    const codemagicYaml = await readFile(join(projectDir, 'codemagic.yaml'), 'utf8')
    expect(codemagicYaml).toContain('android-release:')
    expect(codemagicYaml).toContain('ios-release:')
    expect(codemagicYaml).toContain('pnpm --filter @my-app/main-app mobile:build')
    expect(codemagicYaml).toContain('pnpm --filter @my-app/main-app cap:sync')
    expect(codemagicYaml).toContain('CM_KEYSTORE_PATH')
    expect(codemagicYaml).toContain('GOOGLE_PLAY_SERVICE_ACCOUNT_CREDENTIALS')
    expect(codemagicYaml).toContain('NEXT_BUILD_NUMBER')
    expect(codemagicYaml).toContain('CURRENT_PROJECT_VERSION')
    expect(codemagicYaml).toContain('submit_to_testflight: true')
    expect(codemagicYaml).toContain('PACKAGE_NAME: "com.vibestart.myapp"')
    expect(codemagicYaml).toContain('bundle_identifier: "com.vibestart.myapp"')
    expect(codemagicYaml.match(/- mobile/gu)).toHaveLength(2)
    await expect(
      readFile(join(projectDir, 'apps/main-app/android/app/src/main/res/layout/activity_main.xml'), 'utf8'),
    ).resolves.toContain('android:fitsSystemWindows="true"')
    await expect(
      readFile(join(projectDir, 'apps/main-app/android/app/src/main/AndroidManifest.xml'), 'utf8'),
    ).resolves.toContain('android:name="com.vibestart.myapp.MainActivity"')
    await expect(
      readFile(join(projectDir, 'apps/main-app/android/app/src/main/java/com/vibestart/app/MainActivity.java'), 'utf8'),
    ).resolves.toContain('package com.vibestart.myapp;')
    await expect(
      readFile(join(projectDir, 'apps/main-app/ios/App/App.xcodeproj/project.pbxproj'), 'utf8'),
    ).resolves.toContain('PRODUCT_BUNDLE_IDENTIFIER = com.vibestart.myapp;')
    await expect(readFile(join(projectDir, 'apps/main-app/ios/App/App/Info.plist'), 'utf8')).resolves.toContain(
      '<string>my-app</string>',
    )
    await expect(
      readFile(join(projectDir, 'apps/main-app/android/app/src/main/res/values/strings.xml'), 'utf8'),
    ).resolves.toContain('<string name="app_name">my-app</string>')
    await expect(
      readFile(join(projectDir, 'apps/main-app/android/app/src/main/res/values/strings.xml'), 'utf8'),
    ).resolves.toContain('<string name="package_name">com.vibestart.myapp</string>')

    await execFileAsync(
      process.execPath,
      [join(projectDir, 'packages/vite-capacitor/scripts/cli.mjs'), 'app-id', 'com.example.changed'],
      {cwd: join(projectDir, 'apps/main-app')},
    )

    await expect(readFile(join(projectDir, 'apps/main-app/capacitor.config.ts'), 'utf8')).resolves.toContain(
      "appId: 'com.example.changed'",
    )
    await expect(readFile(join(projectDir, 'apps/main-app/android/app/build.gradle'), 'utf8')).resolves.toContain(
      'applicationId "com.example.changed"',
    )
    await expect(
      readFile(join(projectDir, 'apps/main-app/android/app/src/main/AndroidManifest.xml'), 'utf8'),
    ).resolves.toContain('android:name="com.example.changed.MainActivity"')
    await expect(
      readFile(join(projectDir, 'apps/main-app/android/app/src/main/java/com/vibestart/app/MainActivity.java'), 'utf8'),
    ).resolves.toContain('package com.example.changed;')
    await expect(
      readFile(join(projectDir, 'apps/main-app/ios/App/App.xcodeproj/project.pbxproj'), 'utf8'),
    ).resolves.toContain('PRODUCT_BUNDLE_IDENTIFIER = com.example.changed;')
    await expect(
      readFile(join(projectDir, 'apps/main-app/android/app/src/main/res/values/strings.xml'), 'utf8'),
    ).resolves.toContain('<string name="custom_url_scheme">com.example.changed</string>')

    await expect(
      execFileAsync(
        process.execPath,
        [join(projectDir, 'packages/vite-capacitor/scripts/cli.mjs'), 'app-id', 'com.example.my_app'],
        {cwd: join(projectDir, 'apps/main-app')},
      ),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('lowercase reverse-domain notation'),
    })

    await execFileAsync(
      process.execPath,
      [join(projectDir, 'packages/vite-capacitor/scripts/cli.mjs'), 'app-id', 'ios', 'com.example.ios'],
      {cwd: join(projectDir, 'apps/main-app')},
    )
    await execFileAsync(
      process.execPath,
      [join(projectDir, 'packages/vite-capacitor/scripts/cli.mjs'), 'app-id', 'android', 'com.example.android'],
      {cwd: join(projectDir, 'apps/main-app')},
    )

    await expect(
      readFile(join(projectDir, 'apps/main-app/ios/App/App.xcodeproj/project.pbxproj'), 'utf8'),
    ).resolves.toContain('PRODUCT_BUNDLE_IDENTIFIER = com.example.ios;')
    await expect(readFile(join(projectDir, 'apps/main-app/android/app/build.gradle'), 'utf8')).resolves.toContain(
      'applicationId "com.example.android"',
    )
    await expect(readFile(join(projectDir, 'codemagic.yaml'), 'utf8')).resolves.toContain(
      'bundle_identifier: "com.example.ios"',
    )
    await expect(readFile(join(projectDir, 'codemagic.yaml'), 'utf8')).resolves.toContain(
      'PACKAGE_NAME: "com.example.android"',
    )
  })

  it('keeps uppercase project name characters in the generated native app ID after lowercasing', async () => {
    const projectDir = join(testDir, 'project')
    const {generateTemplate} = await import('../generate-template')

    await generateTemplate(projectDir, {projectName: 'My App'})

    await expect(readFile(join(projectDir, 'apps/main-app/capacitor.config.ts'), 'utf8')).resolves.toContain(
      "appId: 'com.vibestart.myapp'",
    )
  })

  it('renders template directories from the manifest', async () => {
    const templateDir = join(testDir, 'template')
    const projectDir = join(testDir, 'project')
    await mkdir(join(templateDir, 'snippets'), {recursive: true})
    await writeFile(
      join(templateDir, 'template-manifest.json'),
      `${JSON.stringify({files: [{from: 'snippets', to: 'copied', template: true}]})}\n`,
    )
    await writeFile(join(templateDir, 'snippets', 'hello.txt'), 'Hello {{projectName}}\n')
    const {generateTemplate} = await import('../generate-template')

    await generateTemplate(projectDir, {projectName: 'my-app'}, templateDir)

    await expect(readFile(join(projectDir, 'copied', 'hello.txt'), 'utf8')).resolves.toBe('Hello my-app\n')
  })

  it('renders template directories to their source path when to is omitted', async () => {
    const templateDir = join(testDir, 'template')
    const projectDir = join(testDir, 'project')
    await mkdir(join(templateDir, 'snippets'), {recursive: true})
    await writeFile(
      join(templateDir, 'template-manifest.json'),
      `${JSON.stringify({files: [{from: 'snippets', template: true}]})}\n`,
    )
    await writeFile(join(templateDir, 'snippets', 'hello.txt'), 'Hello {{projectName}}\n')
    const {generateTemplate} = await import('../generate-template')

    await generateTemplate(projectDir, {projectName: 'my-app'}, templateDir)

    await expect(readFile(join(projectDir, 'snippets', 'hello.txt'), 'utf8')).resolves.toBe('Hello my-app\n')
  })

  it('derives native app IDs and allows explicit overrides', async () => {
    const templateDir = join(testDir, 'template')
    await mkdir(templateDir, {recursive: true})
    await writeFile(
      join(templateDir, 'template-manifest.json'),
      `${JSON.stringify({files: [{from: 'native.txt', template: true}]})}\n`,
    )
    await writeFile(join(templateDir, 'native.txt'), '{{nativeAppId}}\n')
    const {generateTemplate} = await import('../generate-template')

    const nonStringProjectDir = join(testDir, 'non-string-project')
    await generateTemplate(nonStringProjectDir, {projectName: 1}, templateDir)
    await expect(readFile(join(nonStringProjectDir, 'native.txt'), 'utf8')).resolves.toBe('com.vibestart.app\n')

    const emptySuffixProjectDir = join(testDir, 'empty-suffix-project')
    await generateTemplate(emptySuffixProjectDir, {projectName: '---'}, templateDir)
    await expect(readFile(join(emptySuffixProjectDir, 'native.txt'), 'utf8')).resolves.toBe('com.vibestart.app\n')

    const blankOverrideProjectDir = join(testDir, 'blank-override-project')
    await generateTemplate(blankOverrideProjectDir, {projectName: 'my-app', nativeAppId: '   '}, templateDir)
    await expect(readFile(join(blankOverrideProjectDir, 'native.txt'), 'utf8')).resolves.toBe('com.vibestart.myapp\n')

    const customOverrideProjectDir = join(testDir, 'custom-override-project')
    await generateTemplate(
      customOverrideProjectDir,
      {projectName: 'my-app', nativeAppId: 'com.example.app'},
      templateDir,
    )
    await expect(readFile(join(customOverrideProjectDir, 'native.txt'), 'utf8')).resolves.toBe('com.example.app\n')
  })

  it('uses explicit CLI versions and the bundled package version instead of latest', async () => {
    const templateDir = join(testDir, 'template')
    await mkdir(templateDir, {recursive: true})
    await writeFile(
      join(templateDir, 'template-manifest.json'),
      `${JSON.stringify({files: [{from: 'version.txt', template: true}]})}\n`,
    )
    await writeFile(join(templateDir, 'version.txt'), '{{cliVersion}}\n')
    const {generateTemplate} = await import('../generate-template')

    const explicitDir = join(testDir, 'explicit')
    await generateTemplate(explicitDir, {cliVersion: '9.9.9'}, templateDir)
    await expect(readFile(join(explicitDir, 'version.txt'), 'utf8')).resolves.toBe('9.9.9\n')

    const assertBundledVersion = async (cliVersion: unknown, suffix: string) => {
      const projectDir = join(testDir, `bundled-${suffix}`)
      await generateTemplate(projectDir, {cliVersion}, templateDir)
      await expect(readFile(join(projectDir, 'version.txt'), 'utf8')).resolves.toBe(`${packageJson.version}\n`)
    }

    await assertBundledVersion(' ', 'blank')
    await assertBundledVersion(1, 'type')
  })

  it('copies a local CLI package only for the local-package runtime', async () => {
    const projectDir = join(testDir, 'project')
    const packagePath = join(testDir, 'create-vibe-start.tgz')
    await writeFile(packagePath, 'local package')
    const {generateTemplate} = await import('../generate-template')

    await generateTemplate(projectDir, {projectName: 'my-app'}, undefined, {
      setupRuntime: {kind: 'local-package', packagePath},
    })

    const rootPackageJson = JSON.parse(await readFile(join(projectDir, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
      devDependencies: Record<string, string>
    }
    expect(rootPackageJson.scripts.setup).toBe('create-vibe-start setup --dir .')
    expect(rootPackageJson.devDependencies['create-vibe-start']).toBe('file:.vibe-start/create-vibe-start.tgz')
    await expect(readFile(join(projectDir, '.vibe-start/create-vibe-start.tgz'), 'utf8')).resolves.toBe('local package')
  })

  it('reports an explicit error when the local CLI package is missing', async () => {
    const packagePath = join(testDir, 'missing-create-vibe-start.tgz')
    const {generateTemplate} = await import('../generate-template')

    await expect(
      generateTemplate(join(testDir, 'project'), {}, undefined, {
        setupRuntime: {kind: 'local-package', packagePath},
      }),
    ).rejects.toThrow(`로컬 setup package tarball을 복사할 수 없습니다: ${packagePath}`)
  })

  it('treats a missing template source as a file action and reports the failure', async () => {
    const templateDir = join(testDir, 'template')
    const projectDir = join(testDir, 'project')
    await mkdir(templateDir, {recursive: true})
    await writeFile(
      join(templateDir, 'template-manifest.json'),
      `${JSON.stringify({files: [{from: 'missing.txt', template: true}]})}\n`,
    )
    const {generateTemplate} = await import('../generate-template')

    await expect(generateTemplate(projectDir, {}, templateDir)).rejects.toThrow()
  })

  it('throws plop failure messages', async () => {
    const templateDir = join(testDir, 'template')
    const projectDir = join(testDir, 'project')
    await mkdir(templateDir, {recursive: true})
    await writeFile(
      join(templateDir, 'template-manifest.json'),
      `${JSON.stringify({files: [{from: 'broken.txt', template: true}]})}\n`,
    )
    await writeFile(join(templateDir, 'broken.txt'), '{{#if}}\n')
    const {generateTemplate} = await import('../generate-template')

    await expect(generateTemplate(projectDir, {}, templateDir)).rejects.toThrow()
  })

  it('rejects malformed manifest JSON with a boundary error', async () => {
    const templateDir = join(testDir, 'template')
    const projectDir = join(testDir, 'project')
    await mkdir(templateDir, {recursive: true})
    await writeFile(join(templateDir, 'template-manifest.json'), '{invalid')
    const {generateTemplate} = await import('../generate-template')

    await expect(generateTemplate(projectDir, {}, templateDir)).rejects.toThrow(
      '템플릿 매니페스트가 올바른 JSON이 아닙니다.',
    )
  })

  it('rejects malformed manifest file entries', async () => {
    const templateDir = join(testDir, 'template')
    const projectDir = join(testDir, 'project')
    await mkdir(templateDir, {recursive: true})
    await writeFile(join(templateDir, 'template-manifest.json'), JSON.stringify({files: [{from: 1}]}))
    const {generateTemplate} = await import('../generate-template')

    await expect(generateTemplate(projectDir, {}, templateDir)).rejects.toThrow(
      '템플릿 매니페스트의 files 형식이 올바르지 않습니다.',
    )
  })

  it('rejects manifest output paths outside the project directory before writing files', async () => {
    const templateDir = join(testDir, 'template')
    const projectDir = join(testDir, 'project')
    await mkdir(templateDir, {recursive: true})
    await writeFile(
      join(templateDir, 'template-manifest.json'),
      JSON.stringify({files: [{from: 'source.txt', to: '../outside.txt'}]}),
    )
    await writeFile(join(templateDir, 'source.txt'), 'private')
    const {generateTemplate} = await import('../generate-template')

    await expect(generateTemplate(projectDir, {}, templateDir)).rejects.toThrow(
      '템플릿 출력 경로가 프로젝트 폴더를 벗어납니다: ../outside.txt',
    )
    await expect(readFile(join(testDir, 'outside.txt'), 'utf8')).rejects.toThrow()
  })

  it('rejects the project parent as a manifest output path', async () => {
    const templateDir = join(testDir, 'template')
    const projectDir = join(testDir, 'project')
    await mkdir(templateDir, {recursive: true})
    await writeFile(
      join(templateDir, 'template-manifest.json'),
      JSON.stringify({files: [{from: 'source.txt', to: '..'}]}),
    )
    await writeFile(join(templateDir, 'source.txt'), 'private')
    const {generateTemplate} = await import('../generate-template')

    await expect(generateTemplate(projectDir, {}, templateDir)).rejects.toThrow(
      '템플릿 출력 경로가 프로젝트 폴더를 벗어납니다: ..',
    )
  })

  it('rejects an escaping source path when the manifest output path is omitted', async () => {
    const templateDir = join(testDir, 'template')
    const projectDir = join(testDir, 'project')
    await mkdir(templateDir, {recursive: true})
    await writeFile(join(templateDir, 'template-manifest.json'), JSON.stringify({files: [{from: '../outside.txt'}]}))
    const {generateTemplate} = await import('../generate-template')

    await expect(generateTemplate(projectDir, {}, templateDir)).rejects.toThrow(
      '템플릿 출력 경로가 프로젝트 폴더를 벗어납니다: ../outside.txt',
    )
  })
})
