# Create Vibe Start

`create-vibe-start` is an interactive CLI for creating a new vibe-coding starter project. It prepares GitHub, Vercel, and Codex command-line environments, copies the curated project template, installs dependencies, and can optionally create a GitHub repository, deploy to Vercel, and open Codex.

The package is [published on npm](https://www.npmjs.com/package/create-vibe-start). No clone or local build is required to run it.

## Quick Start

### No Node.js yet

Each [GitHub Release](https://github.com/bichikim/create-vibe-start/releases) ships `install.sh`, `install.ps1`, and `SHA256SUMS`. CI bakes the release version into the installers (for example `vibe-start@0.1.3` and a pinned Node.js 22.x tarball on Linux). Stable releases are cut on `release/latest`; alpha prereleases on `release/alpha`.

**Recommended** — download, verify checksums, then run (macOS / Linux):

```bash
VERSION=v0.1.3
BASE="https://github.com/bichikim/create-vibe-start/releases/download/${VERSION}"
curl -fsSL "${BASE}/SHA256SUMS" -o SHA256SUMS
curl -fsSL "${BASE}/install.sh" -o install.sh
sha256sum -c SHA256SUMS && bash install.sh
```

Windows (PowerShell):

```powershell
$Version = "v0.1.3"
$Base = "https://github.com/bichikim/create-vibe-start/releases/download/$Version"
Invoke-WebRequest "$Base/SHA256SUMS" -OutFile SHA256SUMS
Invoke-WebRequest "$Base/install.ps1" -OutFile install.ps1
$expected = ((Get-Content SHA256SUMS) -split '\s+')[0]
$actual = (Get-FileHash install.ps1 -Algorithm SHA256).Hash.ToLower()
if ($actual -ne $expected) { throw "Checksum mismatch for install.ps1" }
.\install.ps1
```

Replace `v0.1.3` with your [release tag](https://github.com/bichikim/create-vibe-start/releases). Alpha tags look like `v0.1.3-alpha.3`. The installer npm spec always matches that tag’s package version.

**Quick (unverified)** — same scripts, pipe directly (skips checksum verification):

```bash
curl -fsSL https://github.com/bichikim/create-vibe-start/releases/latest/download/install.sh | bash
```

```powershell
irm https://github.com/bichikim/create-vibe-start/releases/latest/download/install.ps1 | iex
```

`releases/latest` points at the newest **stable** release only, not alpha.

### Desktop app

The same GitHub Release also contains a signed macOS Universal DMG and Windows NSIS installer. The desktop app covers the project creation flow with tool setup, GitHub/Vercel login, progress, cancellation, and failed-step retry. The CLI remains fully supported, including `reset` and `repair vercel`.

The app bundles its own pinned Node.js and GitHub CLI runtime, then installs pinned pnpm, Vercel CLI, and Codex CLI packages under the app data directory. It does not change the system PATH or global npm packages. Git remains a system prerequisite.

### Already have Node.js 22+

Run the project creation flow (downloads `create-vibe-start` from npm and starts the interactive CLI):

```bash
npm create vibe-start
```

Other package managers:

```bash
pnpm create vibe-start
```

```bash
npx create-vibe-start
```

Use the newest alpha build from the `alpha` dist-tag:

```bash
npm create vibe-start@alpha
```

Pass CLI flags after `--` (for example, skip external tool setup during CI or scripting):

```bash
npm create vibe-start -- --skip-github --skip-vercel --skip-codex
```

## Global Install

Install globally with npm:

```bash
npm install -g create-vibe-start
```

Install globally with pnpm:

```bash
pnpm add -g create-vibe-start
```

## Usage

Start the project creation flow:

```bash
create-vibe-start
```

Show available commands and options:

```bash
create-vibe-start --help
```

Show reset command options:

```bash
create-vibe-start reset --help
```

Run the post-creation deployment wizard from a generated project:

```bash
cd my-app
pnpm run setup
```

The wizard can connect a new or existing GitHub repository, configure and deploy Vercel after project creation, prepare iOS and Android store identifiers, connect Codemagic, and optionally start the mobile release workflows.

Repair Vercel setup for an existing generated project:

```bash
create-vibe-start repair vercel --dir ./my-app --project-name my-app
```

If the project is not linked to Vercel yet, pass the GitHub repository too:

```bash
create-vibe-start repair vercel --dir ./my-app --project-name my-app --github-repository owner/my-app
```

Reset local CLI installs and auth/config files:

```bash
create-vibe-start reset
```

Preview reset steps without changing files:

```bash
create-vibe-start reset --dry-run --yes
```

The reset command covers GitHub CLI, Vercel CLI, and Codex CLI setup. It removes local auth/config files and attempts to uninstall globally installed Vercel and Codex packages through detected package managers.

## Generated Project Template

After the tool setup checks, the CLI asks for a project name and directory, then writes starter files from `templates/template-manifest.json`. The current template creates a Nitro + Vue workspace with Better Auth, oRPC, and Drizzle.

## Development

```bash
pnpm install
pnpm dev
pnpm build
pnpm verify:local-setup
pnpm desktop:dev
pnpm desktop:build
```

`pnpm build` continues to produce `dist/cli.js` and also creates the self-contained desktop worker. `pnpm desktop:build` synchronizes the Tauri version with `package.json` before building the native installer.

`pnpm dev` builds and packs the unpublished CLI before starting the interactive project generator. The generated development project automatically embeds that tarball under `.vibe-start/` and uses it for `pnpm run setup`; no manual `--local-setup-package` option is needed. Extra CLI options can still be passed after `pnpm dev --`.

`pnpm verify:local-setup` exercises the same development packaging path non-interactively: build, pack, project generation with the exact prepared tarball, dependency installation, and `pnpm run setup --check`. Normal generated projects keep using the exact npm version from this package and do not include the local tarball.

Resource paths are resolved from the running module or app bundle, never from the current working directory:

| Runtime               | Templates                              | Desktop worker/runtime                                     |
| --------------------- | -------------------------------------- | ---------------------------------------------------------- |
| CLI development       | repository `templates/`                | —                                                          |
| Built CLI             | `dist/templates/` beside `dist/cli.js` | —                                                          |
| Desktop development   | repository `dist/templates/`           | repository `dist/desktop-worker/` and `src-tauri/runtime/` |
| Installed desktop app | app resource `templates/`              | app resource `desktop-worker/` and `runtime/`              |

`pnpm desktop:dev` runs `pnpm build` first so the development worker and copied templates always exist. Desktop path selection and bundle mappings are covered by both debug- and release-profile Rust tests.

### Git-less Docker sanity check (Linux)

[`docker/gitless-test.Dockerfile`](docker/gitless-test.Dockerfile) builds a Debian-based image with Node.js and **without** Git, so you can manually exercise the Linux Git install branch (`apt-get install git`; root in the container). Build and drop into an interactive shell:

```bash
docker build -f docker/gitless-test.Dockerfile -t create-vibe-start:gitless .
docker run --rm -it create-vibe-start:gitless
```

Inside the container, run something like:

```bash
node dist/cli.js --skip-vercel --skip-codex
```

Interactive prompts assume a TTY (`-it`).

## Alpha Release Automation

Publish a new alpha in two local steps, then let GitHub Actions create the prerelease and publish to npm.

### Maintainer checklist

1. Bump the alpha prerelease version locally (updates `package.json` only; no git commit or tag):

   ```bash
   pnpm run version:alpha
   git add package.json
   git commit -m "chore: release v$(node -p "require('./package.json').version")"
   ```

   This runs `pnpm version prerelease --preid=alpha --no-git-tag-version` (for example `0.1.1-alpha.2` → `0.1.1-alpha.3`). Git tags are created later by CI on `release/alpha`, not locally.

2. Push the commit, then merge into `release/alpha`:

   ```bash
   git push origin HEAD
   ```

   Alpha release automation runs only on `release/alpha`. Pushing to `main` alone does not trigger it.

3. Confirm the [Alpha Release Gate](.github/workflows/alpha-release.yml) workflow on `release/alpha`, then confirm [Publish to npm](.github/workflows/npm-publish.yml) after the GitHub prerelease is published.

### How CI works

- Push or merge into `release/alpha` triggers `.github/workflows/alpha-release.yml`.
- The workflow reads `package.json` version and compares it against the latest npm alpha version for `create-vibe-start`.
- Release runs only when `package.json` is an alpha version and strictly newer than npm's latest alpha.
- On pass, it creates the `v<package.json version>` tag and a draft GitHub prerelease containing `install.sh`, `install.ps1`, and `SHA256SUMS`.
- It dispatches the signed desktop build. The draft is published only after notarized macOS Universal DMG, Authenticode-signed Windows NSIS, and signed updater artifacts all pass verification.
- The workflow requires the release and signing secrets listed in [`docs/desktop-release.md`](docs/desktop-release.md).
- npm publish is not executed in `alpha-release.yml`.
- The existing publish workflow `.github/workflows/npm-publish.yml` remains the single publisher and runs from `release: published`.
- Because prereleases have `prerelease: true`, the existing publish flow resolves npm dist-tag to `alpha`.

### Troubleshooting

- Alpha Release Gate reports `package-version-is-not-newer-than-npm-alpha`: bump again with `pnpm run version:alpha`, commit, and merge into `release/alpha`.
- Tag `v…` already exists on the remote but npm was not updated: the release gate skips tag creation; fix npm publish or delete the remote tag only if that release should be retried.
- No npm publish after a successful prerelease: check that `RELEASE_TOKEN` is set and that `npm-publish.yml` ran on the `release: published` event.

## Latest Release Automation

Publish a new stable release the same way as alpha: bump `package.json` locally, then let CI create the tag, GitHub release, and npm publish.

### Maintainer checklist

1. Bump the stable version locally (updates `package.json` only; no git commit or tag):

   ```bash
   pnpm run version:latest
   git add package.json
   git commit -m "chore: release v$(node -p "require('./package.json').version")"
   ```

   This runs `pnpm version patch --no-git-tag-version`. The version must be a stable semver (no `-alpha` suffix). Git tags are created later by CI on `release/latest`, not locally.

2. Push the commit, then merge into `release/latest`:

   ```bash
   git push origin HEAD
   ```

   Latest release automation runs only on `release/latest`. Pushing to `main` alone does not trigger it.

3. Confirm the [Latest Release Gate](.github/workflows/latest-release.yml) workflow on `release/latest`, then confirm [Publish to npm](.github/workflows/npm-publish.yml) after the GitHub release is published.

### How CI works

- Push or merge into `release/latest` triggers `.github/workflows/latest-release.yml`.
- The workflow reads `package.json` version and compares it against the latest npm stable version for `create-vibe-start` (prereleases such as `-alpha.` are ignored).
- Release runs only when `package.json` is a stable semver (`x.y.z` with no prerelease suffix) and strictly newer than npm's latest stable.
- On pass, it creates the `v<package.json version>` tag and a draft GitHub release containing `install.sh`, `install.ps1`, and `SHA256SUMS`.
- It dispatches the signed desktop build. The draft is published only after notarized macOS Universal DMG, Authenticode-signed Windows NSIS, and signed updater artifacts all pass verification.
- The workflow requires the release and signing secrets listed in [`docs/desktop-release.md`](docs/desktop-release.md).
- npm publish is not executed in `latest-release.yml`.
- The existing publish workflow `.github/workflows/npm-publish.yml` remains the single publisher and runs from `release: published`.
- Because stable releases are not prereleases, the publish flow resolves npm dist-tag to `latest`.

### Troubleshooting

- Latest Release Gate reports `package-version-is-not-stable`: set a stable semver in `package.json` (no `-alpha` suffix) before merging into `release/latest`.
- Latest Release Gate reports `package-version-is-not-newer-than-npm-stable`: bump again with `pnpm run version:latest`, commit, and merge into `release/latest`.
- Tag `v…` already exists on the remote but npm was not updated: the release gate skips tag creation; fix npm publish or delete the remote tag only if that release should be retried.
- No npm publish after a successful release: check that `RELEASE_TOKEN` is set and that `npm-publish.yml` ran on the `release: published` event.

## CLI Flow

Default `create-vibe-start` flow (use `--skip-github`, `--skip-vercel`, or `--skip-codex` to omit a tool setup step):

```txt
Welcome
  -> GitHub CLI setup
  -> Vercel CLI setup
  -> Codex CLI setup
  -> Create new project? (prompt)
       | no  -> Complete
       | yes v
         Project name -> Project directory
           -> Generate template -> Install dependencies
           -> Create GitHub repository? (prompt; GitHub setup ready, not skipped)
           -> Deploy to Vercel? (prompt; GitHub repo created, Vercel setup ready, not skipped)
           -> Launch Codex app (when Codex setup was not skipped)
           -> Complete
```

`create-vibe-start reset` is a separate command that clears GitHub, Vercel, and Codex CLI installs and auth files (see [Reset](#usage) above).
