# Desktop release secrets

Desktop releases are created as drafts. The `Desktop Release` workflow publishes the release only after both the macOS Universal DMG and Windows NSIS builds succeed. Platform signing and notarization are used when the corresponding credentials are configured.

Configure these GitHub Actions secrets:

- `RELEASE_TOKEN`: fine-grained token with repository contents and Actions access, used to dispatch the signed build and publish the draft.
- `TAURI_UPDATER_PUBLIC_KEY`, `TAURI_UPDATER_PRIVATE_KEY`, `TAURI_UPDATER_PRIVATE_KEY_PASSWORD`: Tauri updater signing keys.
- `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`: optional Developer ID Application certificate values used by Tauri. If omitted or incomplete, macOS uses ad-hoc signing and the workflow emits a warning.
- `APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_KEY_CONTENT`: optional App Store Connect API values used for notarization. These are required together with the Apple certificate values for a notarized build.
- `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD`: optional base64-encoded PFX and password imported into the runner certificate store. If omitted, the Windows installer is built without Authenticode signing and the workflow emits a warning. The combined macOS and Windows release still requires the macOS secrets above for its macOS build.

The macOS and Windows matrix jobs run independently, so missing signing credentials do not cancel either build. The artifacts are still published, but unsigned Windows installers may trigger SmartScreen warnings and ad-hoc macOS apps may require manual approval in Privacy & Security.

The managed Node and GitHub CLI archives are downloaded from their official release locations during the build, checked against the publishers' SHA-256 lists, and recorded in the bundled `toolchain.json`. Managed pnpm, Vercel CLI, and Codex CLI versions are pinned in the same manifest and installed under the app data directory without changing the system PATH.
