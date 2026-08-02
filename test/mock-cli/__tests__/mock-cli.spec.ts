import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execa} from 'execa'
import {afterEach, describe, expect, it} from 'vitest'
import {createMockCliSession, type MockCliSession} from '../helpers/with-mock-path'
import {stubVersions} from '../lib/scenario.mjs'

describe('mock CLI PATH harness', () => {
  let session: MockCliSession | undefined
  const tempDirs: string[] = []

  afterEach(async () => {
    await session?.cleanup()
    session = undefined
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, {recursive: true, force: true})))
  })

  async function makeTempDir() {
    const dir = await mkdtemp(join(tmpdir(), 'mock-cli-case-'))
    tempDirs.push(dir)
    return dir
  }

  it('resolves stub binaries from PATH with stub version strings', async () => {
    session = await createMockCliSession()

    const [gh, vercel, codex, pnpm] = await Promise.all([
      execa('gh', ['--version'], {env: session.env}),
      execa('vercel', ['--version'], {env: session.env}),
      execa('codex', ['--version'], {env: session.env}),
      execa('pnpm', ['--version'], {env: session.env}),
    ])

    expect(gh.stdout).toContain(stubVersions.gh)
    expect(vercel.stdout).toContain(stubVersions.vercel)
    expect(codex.stdout).toContain(stubVersions.codex)
    expect(pnpm.stdout).toContain(stubVersions.pnpm)
  })

  it('passes auth status checks for gh, vercel, and codex', async () => {
    session = await createMockCliSession()

    await expect(execa('gh', ['auth', 'status'], {env: session.env})).resolves.toMatchObject({exitCode: 0})
    await expect(execa('vercel', ['whoami'], {env: session.env})).resolves.toMatchObject({
      exitCode: 0,
      stdout: 'mock-vercel-user',
    })
    await expect(execa('codex', ['login', 'status'], {env: session.env})).resolves.toMatchObject({exitCode: 0})
  })

  it('simulates gh repo create and view without network push', async () => {
    session = await createMockCliSession({owner: 'mock-owner', projectName: 'demo-app'})
    const repoDir = await makeTempDir()

    await execa('git', ['init'], {cwd: repoDir})
    await execa('git', ['config', 'user.name', 'Mock User'], {cwd: repoDir})
    await execa('git', ['config', 'user.email', 'mock@example.com'], {cwd: repoDir})
    await writeFile(join(repoDir, 'README.md'), '# demo\n')
    await execa('git', ['add', '.'], {cwd: repoDir})
    await execa('git', ['commit', '-m', 'init'], {cwd: repoDir})

    await execa(
      'gh',
      ['repo', 'create', 'demo-app', '--private', '--source', '.', '--remote', 'origin', '--push'],
      {cwd: repoDir, env: session.env},
    )

    const view = await execa(
      'gh',
      ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'],
      {cwd: repoDir, env: session.env},
    )

    expect(view.stdout.trim()).toBe('mock-owner/demo-app')

    const remote = await execa('git', ['remote', 'get-url', 'origin'], {cwd: repoDir})
    expect(remote.stdout.trim()).toBe('https://github.com/mock-owner/demo-app.git')

    const calls = await session.readCalls()
    expect(calls.map((call) => [call.bin, ...call.args])).toEqual([
      ['gh', 'repo', 'create', 'demo-app', '--private', '--source', '.', '--remote', 'origin', '--push'],
      ['gh', 'repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'],
    ])
  })

  it('writes production env keys for vercel env pull', async () => {
    session = await createMockCliSession()
    const projectDir = await makeTempDir()
    const envFile = join(projectDir, '.env.migrate.local')

    await execa(
      'vercel',
      ['env', 'pull', envFile, '--environment', 'production', '--yes'],
      {cwd: projectDir, env: session.env},
    )

    const content = await readFile(envFile, 'utf8')
    expect(content).toContain('TURSO_DATABASE_URL=libsql://mock-db.turso.io')
    expect(content).toContain('TURSO_AUTH_TOKEN=mock-turso-token')
    expect(content).toContain('BETTER_AUTH_SECRET=mock-better-auth-secret')
  })

  it('rejects unsupported subcommands with a non-zero exit', async () => {
    session = await createMockCliSession()

    await expect(execa('gh', ['gist', 'list'], {env: session.env})).rejects.toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining('unsupported args'),
    })
  })

  it('no-ops pnpm install, db:migrate, and cap update', async () => {
    session = await createMockCliSession()
    const projectDir = await makeTempDir()
    const appDir = join(projectDir, 'apps/main-app')
    await mkdir(appDir, {recursive: true})

    await execa('pnpm', ['i'], {cwd: projectDir, env: session.env})
    await execa('pnpm', ['db:migrate'], {cwd: appDir, env: session.env})
    await execa('pnpm', ['exec', 'cap', 'update', 'android'], {
      cwd: appDir,
      env: session.env,
    })

    const calls = await session.readCalls()
    expect(calls.map((call) => [call.bin, ...call.args])).toEqual([
      ['pnpm', 'i'],
      ['pnpm', 'db:migrate'],
      ['pnpm', 'exec', 'cap', 'update', 'android'],
    ])
  })
})

