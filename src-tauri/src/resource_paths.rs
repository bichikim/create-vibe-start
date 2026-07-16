use std::path::{Path, PathBuf};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum DesktopMode {
    #[cfg_attr(not(debug_assertions), allow(dead_code))]
    Development,
    Production,
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) struct DesktopResourcePaths {
    pub(crate) runtime_dir: PathBuf,
    pub(crate) worker: PathBuf,
    pub(crate) template_dir: PathBuf,
}

pub(crate) fn current_desktop_mode() -> DesktopMode {
    #[cfg(debug_assertions)]
    {
        DesktopMode::Development
    }
    #[cfg(not(debug_assertions))]
    {
        DesktopMode::Production
    }
}

pub(crate) fn resolve_desktop_resource_paths(
    manifest_dir: &Path,
    resource_dir: Option<&Path>,
    mode: DesktopMode,
) -> Result<DesktopResourcePaths, String> {
    match mode {
        DesktopMode::Development => {
            let repository_root = manifest_dir
                .parent()
                .ok_or("Tauri 프로젝트의 저장소 루트를 확인할 수 없습니다.")?;
            Ok(DesktopResourcePaths {
                runtime_dir: manifest_dir.join("runtime"),
                worker: repository_root
                    .join("dist")
                    .join("desktop-worker")
                    .join("index.js"),
                template_dir: repository_root.join("dist").join("templates"),
            })
        }
        DesktopMode::Production => {
            let resource_dir = resource_dir.ok_or("앱 리소스 폴더를 확인할 수 없습니다.")?;
            Ok(DesktopResourcePaths {
                runtime_dir: resource_dir.join("runtime"),
                worker: resource_dir.join("desktop-worker").join("index.js"),
                template_dir: resource_dir.join("templates"),
            })
        }
    }
}

pub(crate) fn node_executable(runtime_dir: &Path, windows: bool) -> PathBuf {
    if windows {
        runtime_dir.join("node").join("node.exe")
    } else {
        runtime_dir.join("node").join("bin").join("node")
    }
}

pub(crate) fn npm_cli(runtime_dir: &Path, windows: bool) -> PathBuf {
    if windows {
        runtime_dir
            .join("node")
            .join("node_modules")
            .join("npm")
            .join("bin")
            .join("npm-cli.js")
    } else {
        runtime_dir
            .join("node")
            .join("lib")
            .join("node_modules")
            .join("npm")
            .join("bin")
            .join("npm-cli.js")
    }
}

pub(crate) fn gh_executable(runtime_dir: &Path, windows: bool) -> PathBuf {
    runtime_dir
        .join("gh")
        .join(if windows { "gh.exe" } else { "gh" })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    #[test]
    fn resolves_all_development_resources_from_the_repository() {
        let paths = resolve_desktop_resource_paths(
            Path::new("/repo/src-tauri"),
            Some(Path::new("/ignored/debug/resources")),
            DesktopMode::Development,
        )
        .expect("resolve development resources");

        assert_eq!(
            paths,
            DesktopResourcePaths {
                runtime_dir: PathBuf::from("/repo/src-tauri/runtime"),
                worker: PathBuf::from("/repo/dist/desktop-worker/index.js"),
                template_dir: PathBuf::from("/repo/dist/templates"),
            }
        );
    }

    #[test]
    fn selects_resource_mode_from_the_build_profile() {
        #[cfg(debug_assertions)]
        assert_eq!(current_desktop_mode(), DesktopMode::Development);
        #[cfg(not(debug_assertions))]
        assert_eq!(current_desktop_mode(), DesktopMode::Production);
    }

    #[test]
    fn resolves_all_production_resources_from_the_app_bundle() {
        let paths = resolve_desktop_resource_paths(
            Path::new("/build-machine/src-tauri"),
            Some(Path::new("/app/Resources")),
            DesktopMode::Production,
        )
        .expect("resolve production resources");

        assert_eq!(
            paths,
            DesktopResourcePaths {
                runtime_dir: PathBuf::from("/app/Resources/runtime"),
                worker: PathBuf::from("/app/Resources/desktop-worker/index.js"),
                template_dir: PathBuf::from("/app/Resources/templates"),
            }
        );
        assert!(resolve_desktop_resource_paths(
            Path::new("/build-machine/src-tauri"),
            None,
            DesktopMode::Production,
        )
        .is_err());
    }

    #[test]
    fn resolves_managed_executables_for_macos_and_windows() {
        let runtime = Path::new("/app/runtime");

        assert_eq!(
            node_executable(runtime, false),
            Path::new("/app/runtime/node/bin/node")
        );
        assert_eq!(
            node_executable(runtime, true),
            Path::new("/app/runtime/node/node.exe")
        );
        assert_eq!(
            npm_cli(runtime, false),
            Path::new("/app/runtime/node/lib/node_modules/npm/bin/npm-cli.js")
        );
        assert_eq!(
            npm_cli(runtime, true),
            Path::new("/app/runtime/node/node_modules/npm/bin/npm-cli.js")
        );
        assert_eq!(
            gh_executable(runtime, false),
            Path::new("/app/runtime/gh/gh")
        );
        assert_eq!(
            gh_executable(runtime, true),
            Path::new("/app/runtime/gh/gh.exe")
        );
    }

    #[test]
    fn build_commands_and_bundle_mappings_match_resource_layout() {
        let config: Value = serde_json::from_str(include_str!("../tauri.conf.json"))
            .expect("parse Tauri configuration");
        let resources = config["bundle"]["resources"]
            .as_object()
            .expect("bundle resources");

        assert_eq!(resources["../dist/desktop-worker"], "desktop-worker");
        assert_eq!(resources["../dist/templates"], "templates");
        assert_eq!(resources["runtime"], "runtime");
        assert_eq!(
            config["build"]["beforeBuildCommand"],
            "pnpm build && pnpm desktop:web:build"
        );

        let package: Value =
            serde_json::from_str(include_str!("../../package.json")).expect("parse package.json");
        assert_eq!(package["scripts"]["desktop:dev"], "pnpm build && tauri dev");
    }
}
