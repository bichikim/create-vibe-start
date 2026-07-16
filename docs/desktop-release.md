# Desktop release secrets

Desktop releases are created as drafts. The `Signed Desktop Release` workflow publishes the release only after both the macOS Universal DMG and Windows NSIS builds succeed.

Configure these GitHub Actions secrets:

- `RELEASE_TOKEN`: fine-grained token with repository contents and Actions access, used to dispatch the signed build and publish the draft.
- `TAURI_UPDATER_PUBLIC_KEY`, `TAURI_UPDATER_PRIVATE_KEY`, `TAURI_UPDATER_PRIVATE_KEY_PASSWORD`: Tauri updater signing keys.
- `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`: Developer ID Application certificate values used by Tauri.
- `APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_KEY_CONTENT`: App Store Connect API values used for notarization.
- `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD`: base64-encoded PFX and password imported into the runner certificate store.

The managed Node and GitHub CLI archives are downloaded from their official release locations during the build, checked against the publishers' SHA-256 lists, and recorded in the bundled `toolchain.json`. Managed pnpm, Vercel CLI, and Codex CLI versions are pinned in the same manifest and installed under the app data directory without changing the system PATH.
