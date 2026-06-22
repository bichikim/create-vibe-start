# {{projectName}}

Single full-stack starter with Nitro, Vue, oRPC, Zod, Drizzle, Better Auth, and SQLite-compatible storage.

## Setup

```sh
pnpm install
cp apps/main-app/.env.example apps/main-app/.env
pnpm --filter @{{projectName}}/main-app db:migrate
pnpm dev
```

Open `http://localhost:3000/login` to create an account. Notes can be listed without signing in; creating notes requires a session.

Local development uses `TURSO_DATABASE_URL=file:./data/app.db`. Set `BETTER_AUTH_SECRET` to a random 32+ character value before production. Vercel deployment provisions Turso through the Marketplace with the `starter` plan in `iad1` and automatically injects `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. On Vercel, `BETTER_AUTH_URL` is resolved at runtime from `VERCEL_URL` / `VERCEL_PROJECT_PRODUCTION_URL` unless you set it explicitly. `create-vibe-start` sets production `BETTER_AUTH_SECRET` and runs `db:migrate` on Turso before the first deploy. Vercel builds also run `pnpm db:migrate` before `pnpm build`.

## Mobile development

This project includes Capacitor for local iOS and Android development.

Run one mobile target:

```sh
pnpm ios:dev
pnpm android:dev
```

The mobile development commands run Vite in an `ios` or `android` mode, then launch Capacitor with live reload after the dev server starts. The default development commands target iOS Simulator and Android Emulator. iOS commands use `/Applications/Xcode.app/Contents/Developer` by default, even if `xcode-select` points at Command Line Tools. If Xcode is installed somewhere else, set `DEVELOPER_DIR` before running iOS commands:

```sh
export DEVELOPER_DIR=/path/to/Xcode.app/Contents/Developer
```

To run on a physical device, set `CAP_SERVER_URL` to a URL reachable from that device before running `cap run`.

Change the native app ID with:

```sh
pnpm app-id com.example.myapp
```

Production mobile builds package the Vue client and call the Vercel Nitro API through `VITE_API_URL`.
Mobile builds run Vite in `mobile` mode, so values can live in `apps/main-app/.env.mobile`:

```sh
VITE_API_URL=https://my-app.vercel.app pnpm mobile:build
```

`VITE_API_URL` is the client-visible API origin. Server-only `BETTER_AUTH_URL` still belongs to the Vercel runtime and is resolved from Vercel system env unless explicitly set.

Local debug native builds are available with:

```sh
pnpm ios:build
pnpm android:build
```

iOS builds target iOS Simulator and require macOS and Xcode. Android builds create a debug build and require Android Studio and the Android SDK. App signing, store upload, and production mobile server URL decisions are intentionally left for a later deployment plan.
