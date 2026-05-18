# Create Vibe Start

`create-vibe-start` is an interactive CLI onboarding tool for preparing GitHub, Vercel, and Codex command-line environments before starting AI web app development.

The package is [published on npm](https://www.npmjs.com/package/create-vibe-start). No clone or local build is required to run it.

## Quick Start

Requires **Node.js 22+** (`engines.node` in `package.json`).

Run the onboarding flow (downloads `create-vibe-start` from npm and starts the interactive CLI):

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

Start the onboarding flow:

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

After the onboarding checks, the CLI asks for a project directory and writes starter files from `src/templates/template-manifest.json`. The current template creates a project `README.md`.

## Development

```bash
pnpm install
pnpm dev
pnpm build
```

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
- On pass, it creates `v<package.json version>` tag and a GitHub prerelease via:
  - `gh release create ... --title "v<version>" --generate-notes --prerelease`
- The workflow requires `RELEASE_TOKEN` repository secret (PAT or GitHub App token) for release creation so `release: published` can trigger downstream publish workflow.
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
- On pass, it creates `v<package.json version>` tag and a GitHub release via:
  - `gh release create ... --title "v<version>" --generate-notes` (not a prerelease)
- The workflow requires `RELEASE_TOKEN` repository secret (PAT or GitHub App token) for release creation so `release: published` can trigger downstream publish workflow.
- npm publish is not executed in `latest-release.yml`.
- The existing publish workflow `.github/workflows/npm-publish.yml` remains the single publisher and runs from `release: published`.
- Because stable releases are not prereleases, the publish flow resolves npm dist-tag to `latest`.

### Troubleshooting

- Latest Release Gate reports `package-version-is-not-stable`: set a stable semver in `package.json` (no `-alpha` suffix) before merging into `release/latest`.
- Latest Release Gate reports `package-version-is-not-newer-than-npm-stable`: bump again with `pnpm run version:latest`, commit, and merge into `release/latest`.
- Tag `v…` already exists on the remote but npm was not updated: the release gate skips tag creation; fix npm publish or delete the remote tag only if that release should be retried.
- No npm publish after a successful release: check that `RELEASE_TOKEN` is set and that `npm-publish.yml` ran on the `release: published` event.

## CLI Flow

Default `create-vibe-start` onboarding (use `--skip-github`, `--skip-vercel`, or `--skip-codex` to omit a tool setup step):

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
