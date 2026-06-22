import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const logStepMock = vi.fn()
const logMessageMock = vi.fn()

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

    expect(resolveDefaultTemplateDir()).toBe('templates')
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
    await expect(readFile(join(projectDir, 'package.json'), 'utf8')).resolves.toContain('@vibe-start-app/main-app')
    await expect(readFile(join(projectDir, 'pnpm-workspace.yaml'), 'utf8')).resolves.toContain('catalog:')
    await expect(readFile(join(projectDir, '.env.example'), 'utf8')).resolves.toContain(
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
      '"vue-router": "catalog:"',
    )
    await expect(readFile(join(projectDir, 'apps/main-app/src/App.vue'), 'utf8')).resolves.toContain(
      '<RouterView />',
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
    await expect(readFile(join(projectDir, 'apps/main-app/drizzle.config.ts'), 'utf8')).resolves.toContain(
      "dialect: 'turso'",
    )
    await expect(readFile(join(projectDir, 'apps/main-app/vercel.json'), 'utf8')).resolves.toContain(
      '"buildCommand": "pnpm db:migrate && pnpm build"',
    )
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
    }
    const appPackageJson = JSON.parse(await readFile(join(projectDir, 'apps/main-app/package.json'), 'utf8')) as {
      name: string
      scripts: Record<string, string>
      dependencies: Record<string, string>
      devDependencies: Record<string, string>
    }

    expect(readme.startsWith('# my-app\n')).toBe(true)
    expect(readme).toContain('pnpm --filter @my-app/main-app db:migrate')
    expect(appPackageJson.dependencies).toMatchObject({['better-auth']: 'catalog:'})
    expect(rootPackageJson.name).toBe('my-app')
    expect(rootPackageJson.scripts.dev).toBe('pnpm --filter @my-app/main-app dev')
    expect(rootPackageJson.scripts['ios:dev']).toBe('pnpm --filter @my-app/main-app ios:dev')
    expect(rootPackageJson.scripts['android:build']).toBe('pnpm --filter @my-app/main-app android:build')
    expect(appPackageJson.name).toBe('@my-app/main-app')
    expect(appPackageJson.scripts['mobile:build']).toBe('vite build --config vite.mobile.config.ts --mode mobile')
    expect(appPackageJson.scripts['ios:dev']).toBe('vite --host 0.0.0.0 --port 3000 --mode ios')
    expect(appPackageJson.scripts['android:dev']).toBe('vite --host 0.0.0.0 --port 3000 --mode android')
    expect(appPackageJson.scripts['ios:build']).toBe('vite-capacitor build ios')
    expect(appPackageJson.scripts['android:build']).toBe('vite-capacitor build android')
    await expect(readFile(join(projectDir, 'apps/main-app/src/lib/api-url.ts'), 'utf8')).resolves.toContain(
      'VITE_API_URL',
    )
    await expect(readFile(join(projectDir, 'apps/main-app/vite.mobile.config.ts'), 'utf8')).resolves.toContain(
      'VITE_API_URL is required for mobile production builds.',
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
    ).resolves.toContain("DEVELOPER_DIR: developerDir")
    await expect(
      readFile(join(projectDir, 'packages/vite-capacitor/scripts/with-xcode.mjs'), 'utf8'),
    ).resolves.toContain('Install Xcode from the App Store, then run this iOS command again.')
    await expect(readFile(join(projectDir, 'packages/vite-capacitor/package.json'), 'utf8')).resolves.toContain(
      '"name": "vite-capacitor"',
    )
    await expect(
      readFile(join(projectDir, 'packages/vite-capacitor/scripts/cli.mjs'), 'utf8'),
    ).resolves.toContain('vite-capacitor build <ios|android>')
    await expect(
      readFile(join(projectDir, 'packages/vite-capacitor/scripts/cli.mjs'), 'utf8'),
    ).resolves.toContain("'--mode', 'mobile'")
    await expect(
      readFile(join(projectDir, 'apps/main-app/server/routes/rpc/[...].ts'), 'utf8'),
    ).resolves.toContain("'capacitor://localhost'")
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
    await expect(readFile(join(projectDir, 'apps/main-app/android/app/build.gradle'), 'utf8')).resolves.toContain(
      'applicationId "com.vibestart.myapp"',
    )
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
})
