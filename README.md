# create-vibe-start

`create-vibe-start` is an interactive CLI onboarding tool for preparing GitHub, Vercel, and Codex command-line environments before starting AI web app development.

## Quick Start

Run the onboarding flow with npm:

```bash
npm create vibe-start
```

You can also run the package directly:

```bash
npx create-vibe-start
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

## Development

```bash
pnpm install
pnpm dev
pnpm build
```

## Alpha Release Automation

- Push or merge into `release/alpha` triggers `.github/workflows/alpha-release.yml`.
- The workflow reads `package.json` version and compares it against the latest npm alpha version for `create-vibe-start`.
- Release runs only when `package.json` is an alpha version and strictly newer than npm's latest alpha.
- On pass, it creates `v<package.json version>` tag and a GitHub prerelease via:
  - `gh release create ... --title "v<version>" --generate-notes --prerelease`
- npm publish is not executed in `alpha-release.yml`.
- The existing publish workflow `.github/workflows/npm-publish.yml` remains the single publisher and runs from `release: published`.
- Because prereleases have `prerelease: true`, the existing publish flow resolves npm dist-tag to `alpha`.

## MVP Flow

```txt
Welcome -> GitHub CLI -> Vercel CLI -> Codex CLI -> Complete
```
