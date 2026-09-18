# Desktop release secrets

Desktop releases are created as drafts. The `Signed Desktop Release` workflow publishes the release only after both the macOS Universal DMG and Windows NSIS builds succeed.

Configure these GitHub Actions secrets:

- `RELEASE_TOKEN`: fine-grained token with repository contents and Actions access, used to dispatch the signed build and publish the draft.
- `TAURI_UPDATER_PUBLIC_KEY`, `TAURI_UPDATER_PRIVATE_KEY`, `TAURI_UPDATER_PRIVATE_KEY_PASSWORD`: Tauri updater signing keys.
- `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`: Developer ID Application certificate values used by Tauri.
- `APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_KEY_CONTENT`: App Store Connect API values used for notarization.
- `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD`: optional base64-encoded PFX and password imported into the runner certificate store. If omitted, the Windows installer is built without Authenticode signing and the workflow emits a warning. The combined macOS and Windows release still requires the macOS secrets above for its macOS build.

The macOS and Windows matrix jobs run independently, so a missing macOS certificate no longer cancels the Windows job. The Windows artifact remains available from the Actions run, but publishing the combined release still waits for both jobs to succeed.

The managed Node and GitHub CLI archives are downloaded from their official release locations during the build, checked against the publishers' SHA-256 lists, and recorded in the bundled `toolchain.json`. Managed pnpm, Vercel CLI, and Codex CLI versions are pinned in the same manifest and installed under the app data directory without changing the system PATH.
