mod resource_paths;

use resource_paths::{
    current_desktop_mode, gh_executable, node_executable, npm_cli, resolve_desktop_resource_paths,
    DesktopMode, DesktopResourcePaths,
};
use serde::Serialize;
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    io::{BufRead, BufReader},
    path::{Component, Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{mpsc, Arc, Mutex},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, State};

const EVENT_PREFIX: &str = "VIBE_EVENT:";
const RESULT_PREFIX: &str = "VIBE_RESULT:";
const ERROR_PREFIX: &str = "VIBE_ERROR:";

type SharedChild = Arc<Mutex<Child>>;

#[derive(Default)]
struct ProcessRegistry {
    children: Arc<Mutex<HashMap<String, SharedChild>>>,
}

#[derive(Default)]
struct ApprovedRoots(Mutex<HashSet<PathBuf>>);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OperationOutput {
    execution_id: String,
    stream: String,
    text: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OperationLifecycle {
    execution_id: String,
    exit_code: Option<i32>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ToolStatus {
    tool: &'static str,
    installed: bool,
    authenticated: Option<bool>,
    version: Option<String>,
    message: String,
}

#[derive(Debug, PartialEq, Eq)]
struct ResolvedCommand {
    command: String,
    args: Vec<String>,
}

fn execution_id(prefix: &str) -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("{prefix}-{timestamp}")
}

fn desktop_resource_paths(app: &AppHandle) -> Result<DesktopResourcePaths, String> {
    let mode = current_desktop_mode();
    #[cfg(debug_assertions)]
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    #[cfg(not(debug_assertions))]
    let manifest_dir = Path::new(".");
    let resource_dir = if mode == DesktopMode::Production {
        Some(
            app.path()
                .resource_dir()
                .map_err(|error| error.to_string())?,
        )
    } else {
        None
    };
    resolve_desktop_resource_paths(manifest_dir, resource_dir.as_deref(), mode)
}

fn managed_node(app: &AppHandle) -> Option<PathBuf> {
    let resources = desktop_resource_paths(app).ok()?;
    let executable = node_executable(&resources.runtime_dir, cfg!(target_os = "windows"));
    executable.exists().then_some(executable)
}

fn managed_npm_cli(app: &AppHandle) -> Option<PathBuf> {
    let resources = desktop_resource_paths(app).ok()?;
    let cli = npm_cli(&resources.runtime_dir, cfg!(target_os = "windows"));
    cli.exists().then_some(cli)
}

fn managed_toolchain_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("toolchain"))
        .map_err(|error| error.to_string())
}

fn resolve_tool_from_paths(
    tool: &str,
    resources: &DesktopResourcePaths,
    toolchain_dir: &Path,
    mode: DesktopMode,
    windows: bool,
) -> ResolvedCommand {
    let node = node_executable(&resources.runtime_dir, windows);
    let script = match tool {
        "pnpm" => Some(
            toolchain_dir
                .join("node_modules")
                .join("pnpm")
                .join("bin")
                .join("pnpm.cjs"),
        ),
        "vercel" => Some(
            toolchain_dir
                .join("node_modules")
                .join("vercel")
                .join("dist")
                .join("index.js"),
        ),
        "codex" => Some(
            toolchain_dir
                .join("node_modules")
                .join("@openai")
                .join("codex")
                .join("bin")
                .join("codex.js"),
        ),
        _ => None,
    };
    if let Some(script) = script {
        if mode == DesktopMode::Production || (node.exists() && script.exists()) {
            return ResolvedCommand {
                command: node.to_string_lossy().to_string(),
                args: vec![script.to_string_lossy().to_string()],
            };
        }
    }
    if tool == "node" {
        if mode == DesktopMode::Production || node.exists() {
            return ResolvedCommand {
                command: node.to_string_lossy().to_string(),
                args: vec![],
            };
        }
    }
    if tool == "gh" {
        let executable = gh_executable(&resources.runtime_dir, windows);
        if mode == DesktopMode::Production || executable.exists() {
            return ResolvedCommand {
                command: executable.to_string_lossy().to_string(),
                args: vec![],
            };
        }
    }
    ResolvedCommand {
        command: tool.to_string(),
        args: vec![],
    }
}

fn resolve_tool(app: &AppHandle, tool: &str) -> Result<ResolvedCommand, String> {
    let resources = desktop_resource_paths(app)?;
    let toolchain_dir = managed_toolchain_dir(app)?;
    Ok(resolve_tool_from_paths(
        tool,
        &resources,
        &toolchain_dir,
        current_desktop_mode(),
        cfg!(target_os = "windows"),
    ))
}

fn command_output(app: &AppHandle, tool: &str, args: &[&str]) -> Option<String> {
    let resolved = resolve_tool(app, tool).ok()?;
    let output = Command::new(resolved.command)
        .args(resolved.args)
        .args(args)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Some(if stdout.is_empty() { stderr } else { stdout })
}

fn inspect_tool(
    app: &AppHandle,
    tool: &'static str,
    version_args: &[&str],
    auth_args: Option<&[&str]>,
) -> ToolStatus {
    let version = command_output(app, tool, version_args);
    let installed = version.is_some();
    let authenticated =
        auth_args.map(|args| installed && command_output(app, tool, args).is_some());
    let message = if !installed {
        "설치가 필요합니다".to_string()
    } else if authenticated == Some(false) {
        "로그인이 필요합니다".to_string()
    } else {
        version.clone().unwrap_or_else(|| "사용 가능".to_string())
    };

    ToolStatus {
        tool,
        installed,
        authenticated,
        version,
        message,
    }
}

#[tauri::command]
async fn inspect_tools(app: AppHandle) -> Result<Vec<ToolStatus>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        vec![
            inspect_tool(&app, "git", &["--version"], None),
            inspect_tool(&app, "gh", &["--version"], Some(&["auth", "status"])),
            inspect_tool(&app, "node", &["--version"], None),
            inspect_tool(&app, "pnpm", &["--version"], None),
            inspect_tool(&app, "vercel", &["--version"], Some(&["whoami"])),
            inspect_tool(&app, "codex", &["--version"], Some(&["login", "status"])),
        ]
    })
    .await
    .map_err(|error| error.to_string())
}

fn install_managed_packages(app: &AppHandle) -> Option<ResolvedCommand> {
    let node = managed_node(app)?;
    let npm = managed_npm_cli(app)?;
    let prefix = managed_toolchain_dir(app).ok()?;
    Some(ResolvedCommand {
        command: node.to_string_lossy().to_string(),
        args: vec![
            npm.to_string_lossy().to_string(),
            "install".to_string(),
            "--prefix".to_string(),
            prefix.to_string_lossy().to_string(),
            "--no-audit".to_string(),
            "--no-fund".to_string(),
            "pnpm@11.1.2".to_string(),
            "vercel@54.17.3".to_string(),
            "@openai/codex@0.142.2".to_string(),
        ],
    })
}

fn is_known_tool_action(tool: &str, action: &str) -> bool {
    matches!(
        (tool, action),
        ("git", "install")
            | ("gh", "install" | "login")
            | ("node", "install")
            | ("pnpm", "install")
            | ("vercel", "install" | "login")
            | ("codex", "install" | "login")
    )
}

fn tool_action(app: &AppHandle, tool: &str, action: &str) -> Result<ResolvedCommand, String> {
    if !is_known_tool_action(tool, action) {
        return Err(format!("허용되지 않은 도구 작업입니다: {tool}/{action}"));
    }

    if action == "login" {
        let mut command = resolve_tool(app, tool)?;
        let args = match tool {
            "gh" => vec!["auth", "login", "--web", "--git-protocol", "https"],
            "vercel" => vec!["login"],
            "codex" => vec!["login"],
            _ => return Err(format!("{tool}은 로그인이 필요하지 않습니다.")),
        };
        command.args.extend(args.into_iter().map(str::to_string));
        return Ok(command);
    }

    if action == "install" {
        if matches!(tool, "pnpm" | "vercel" | "codex") {
            return install_managed_packages(app).ok_or_else(|| {
                "앱에 포함된 Node.js 실행 환경을 찾을 수 없습니다. 앱을 다시 설치해주세요."
                    .to_string()
            });
        }
    }

    let (command, args) = match (tool, action) {
        ("git", "install") if cfg!(target_os = "macos") => ("xcode-select", vec!["--install"]),
        ("git", "install") if cfg!(target_os = "windows") => (
            "winget",
            vec![
                "install",
                "--id",
                "Git.Git",
                "--exact",
                "--accept-package-agreements",
                "--accept-source-agreements",
            ],
        ),
        ("node" | "gh", "install") => {
            return Err(format!(
                "{tool} 관리형 실행 파일이 없습니다. 앱을 다시 설치해주세요."
            ));
        }
        _ => return Err(format!("허용되지 않은 도구 작업입니다: {tool}/{action}")),
    };
    Ok(ResolvedCommand {
        command: command.to_string(),
        args: args.into_iter().map(str::to_string).collect(),
    })
}

fn emit_line(
    app: &AppHandle,
    execution_id: &str,
    stream: &str,
    line: &str,
) -> Result<Option<Value>, String> {
    if let Some(raw) = line.strip_prefix(EVENT_PREFIX) {
        let event: Value = serde_json::from_str(raw).map_err(|error| error.to_string())?;
        app.emit("workflow-event", event)
            .map_err(|error| error.to_string())?;
        return Ok(None);
    }
    if let Some(raw) = line.strip_prefix(RESULT_PREFIX) {
        return serde_json::from_str(raw)
            .map(Some)
            .map_err(|error| error.to_string());
    }
    if let Some(raw) = line.strip_prefix(ERROR_PREFIX) {
        let error: Value = serde_json::from_str(raw).map_err(|error| error.to_string())?;
        return Err(error
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("프로젝트 생성에 실패했습니다.")
            .to_string());
    }

    app.emit(
        "operation-output",
        OperationOutput {
            execution_id: execution_id.to_string(),
            stream: stream.to_string(),
            text: line.to_string(),
        },
    )
    .map_err(|error| error.to_string())?;
    Ok(None)
}

fn run_streaming_command(
    app: AppHandle,
    children: Arc<Mutex<HashMap<String, SharedChild>>>,
    execution_id: String,
    command: String,
    args: Vec<String>,
    cwd: Option<PathBuf>,
    path: Option<String>,
) -> Result<Value, String> {
    let mut process = Command::new(&command);
    process
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(path) = path {
        process.env("PATH", path);
    }
    if let Some(cwd) = cwd {
        process.current_dir(cwd);
    }
    let mut child = process
        .spawn()
        .map_err(|error| format!("{command} 실행 실패: {error}"))?;
    let stdout = child.stdout.take().ok_or("표준 출력을 열 수 없습니다.")?;
    let stderr = child.stderr.take().ok_or("오류 출력을 열 수 없습니다.")?;
    let child = Arc::new(Mutex::new(child));
    children
        .lock()
        .map_err(|_| "프로세스 상태 잠금에 실패했습니다.".to_string())?
        .insert(execution_id.clone(), child.clone());

    app.emit(
        "operation-start",
        OperationLifecycle {
            execution_id: execution_id.clone(),
            exit_code: None,
        },
    )
    .map_err(|error| error.to_string())?;

    let (sender, receiver) = mpsc::channel::<(&'static str, String)>();
    let stdout_sender = sender.clone();
    thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            let _ = stdout_sender.send(("stdout", line));
        }
    });
    thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            let _ = sender.send(("stderr", line));
        }
    });

    let mut result = Value::Null;
    let mut reported_error = None;
    let status = loop {
        while let Ok((stream, line)) = receiver.try_recv() {
            match emit_line(&app, &execution_id, stream, &line) {
                Ok(Some(value)) => result = value,
                Ok(None) => {}
                Err(error) => reported_error = Some(error),
            }
        }
        let status = child
            .lock()
            .map_err(|_| "프로세스 상태 잠금에 실패했습니다.".to_string())?
            .try_wait()
            .map_err(|error| error.to_string())?;
        if let Some(status) = status {
            break status;
        }
        thread::sleep(Duration::from_millis(25));
    };

    while let Ok((stream, line)) = receiver.try_recv() {
        match emit_line(&app, &execution_id, stream, &line) {
            Ok(Some(value)) => result = value,
            Ok(None) => {}
            Err(error) => reported_error = Some(error),
        }
    }
    children
        .lock()
        .map_err(|_| "프로세스 상태 잠금에 실패했습니다.".to_string())?
        .remove(&execution_id);
    app.emit(
        "operation-exit",
        OperationLifecycle {
            execution_id,
            exit_code: status.code(),
        },
    )
    .map_err(|error| error.to_string())?;

    if let Some(error) = reported_error {
        Err(error)
    } else if status.success() {
        Ok(result)
    } else {
        Err(format!(
            "{command} 작업이 종료 코드 {:?}로 실패했습니다.",
            status.code()
        ))
    }
}

#[tauri::command]
async fn run_tool_action(
    app: AppHandle,
    state: State<'_, ProcessRegistry>,
    tool: String,
    action: String,
) -> Result<Value, String> {
    let resolved = tool_action(&app, &tool, &action)?;
    let path = managed_path(&app);
    let children = state.children.clone();
    let id = execution_id("tool");
    tauri::async_runtime::spawn_blocking(move || {
        run_streaming_command(
            app,
            children,
            id,
            resolved.command,
            resolved.args,
            None,
            path,
        )
    })
    .await
    .map_err(|error| error.to_string())?
}

fn validate_path_input(path: &Path) -> Result<(), String> {
    if !path.is_absolute()
        || path
            .components()
            .any(|part| matches!(part, Component::ParentDir))
    {
        return Err(
            "프로젝트 경로는 절대 경로여야 하며 상위 경로 이동을 포함할 수 없습니다.".to_string(),
        );
    }
    Ok(())
}

#[tauri::command]
fn authorize_project_root(
    parent_dir: String,
    roots: State<'_, ApprovedRoots>,
) -> Result<(), String> {
    let parent = PathBuf::from(parent_dir);
    validate_path_input(&parent)?;
    let canonical = parent
        .canonicalize()
        .map_err(|error| format!("선택한 폴더를 확인할 수 없습니다: {error}"))?;
    roots
        .0
        .lock()
        .map_err(|_| "허용 경로 상태 잠금에 실패했습니다.".to_string())?
        .insert(canonical);
    Ok(())
}

fn validate_project_root(project_root: &Path, roots: &ApprovedRoots) -> Result<(), String> {
    validate_path_input(project_root)?;
    let parent = project_root
        .parent()
        .ok_or("프로젝트의 상위 폴더가 없습니다.")?;
    let canonical_parent = parent
        .canonicalize()
        .map_err(|error| format!("프로젝트 상위 폴더를 확인할 수 없습니다: {error}"))?;
    if !roots
        .0
        .lock()
        .map_err(|_| "허용 경로 상태 잠금에 실패했습니다.".to_string())?
        .contains(&canonical_parent)
    {
        return Err("사용자가 선택하지 않은 폴더에는 프로젝트를 만들 수 없습니다.".to_string());
    }
    Ok(())
}

fn node_command(app: &AppHandle) -> Result<String, String> {
    resolve_tool(app, "node").map(|command| command.command)
}

fn managed_path(app: &AppHandle) -> Option<String> {
    let mut paths = Vec::new();
    if let Ok(toolchain) = managed_toolchain_dir(app) {
        paths.push(toolchain.join("node_modules").join(".bin"));
    }
    if let Ok(resources) = desktop_resource_paths(app) {
        paths.push(resources.runtime_dir.join("gh"));
        paths.push(if cfg!(target_os = "windows") {
            resources.runtime_dir.join("node")
        } else {
            resources.runtime_dir.join("node").join("bin")
        });
    }
    paths.extend(std::env::split_paths(
        &std::env::var_os("PATH").unwrap_or_default(),
    ));
    std::env::join_paths(paths)
        .ok()
        .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
async fn run_project_workflow(
    app: AppHandle,
    processes: State<'_, ProcessRegistry>,
    roots: State<'_, ApprovedRoots>,
    mut request: Value,
    project_root: String,
) -> Result<Value, String> {
    let project_path = PathBuf::from(&project_root);
    validate_project_root(&project_path, &roots)?;
    if request.get("projectDir").and_then(Value::as_str) != Some(project_root.as_str()) {
        return Err("요청 경로와 승인된 프로젝트 경로가 일치하지 않습니다.".to_string());
    }

    let resources = desktop_resource_paths(&app)?;
    let worker = resources.worker;
    if !worker.exists() {
        return Err(format!(
            "데스크톱 워커를 찾을 수 없습니다: {}",
            worker.display()
        ));
    }
    let template_dir = resources.template_dir;
    if !template_dir.join("template-manifest.json").exists() {
        return Err(format!(
            "프로젝트 템플릿을 찾을 수 없습니다: {}",
            template_dir.display()
        ));
    }
    request
        .as_object_mut()
        .ok_or("프로젝트 생성 요청 형식이 올바르지 않습니다.")?
        .insert(
            "templateDir".to_string(),
            Value::String(template_dir.to_string_lossy().to_string()),
        );
    let request_json = serde_json::to_string(&request).map_err(|error| error.to_string())?;
    let children = processes.children.clone();
    let node = node_command(&app)?;
    let path = managed_path(&app);
    let id = execution_id("project");
    tauri::async_runtime::spawn_blocking(move || {
        run_streaming_command(
            app,
            children,
            id,
            node,
            vec![worker.to_string_lossy().to_string(), request_json],
            None,
            path,
        )
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
fn cancel_operation(execution_id: String, state: State<'_, ProcessRegistry>) -> Result<(), String> {
    kill_registered_process(&execution_id, &state.children)
}

fn kill_registered_process(
    execution_id: &str,
    children: &Mutex<HashMap<String, SharedChild>>,
) -> Result<(), String> {
    let child = children
        .lock()
        .map_err(|_| "프로세스 상태 잠금에 실패했습니다.".to_string())?
        .get(execution_id)
        .cloned();
    if let Some(child) = child {
        child
            .lock()
            .map_err(|_| "프로세스 상태 잠금에 실패했습니다.".to_string())?
            .kill()
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(ProcessRegistry::default())
        .manage(ApprovedRoots::default())
        .invoke_handler(tauri::generate_handler![
            inspect_tools,
            run_tool_action,
            authorize_project_root,
            run_project_workflow,
            cancel_operation
        ])
        .run(tauri::generate_context!())
        .expect("error while running create-vibe-start desktop");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_relative_and_parent_paths() {
        assert!(validate_path_input(Path::new("relative/project")).is_err());
        assert!(validate_path_input(Path::new("/tmp/../secret")).is_err());
    }

    #[test]
    fn only_maps_known_tool_actions() {
        assert!(is_known_tool_action("gh", "login"));
        assert!(!is_known_tool_action("sh", "install"));
        assert!(!is_known_tool_action("git", "login"));
    }

    #[test]
    fn cancellation_terminates_registered_process() {
        let child = if cfg!(target_os = "windows") {
            Command::new("cmd")
                .args(["/C", "ping", "127.0.0.1", "-n", "30"])
                .spawn()
                .expect("spawn test process")
        } else {
            Command::new("sleep")
                .arg("30")
                .spawn()
                .expect("spawn test process")
        };
        let child = Arc::new(Mutex::new(child));
        let children = Mutex::new(HashMap::from([("test".to_string(), child.clone())]));

        kill_registered_process("test", &children).expect("kill test process");
        let status = child
            .lock()
            .expect("lock test process")
            .wait()
            .expect("wait for test process");

        assert!(!status.success());
    }

    #[test]
    fn production_tool_resolution_never_falls_back_to_the_system_path() {
        let resources = DesktopResourcePaths {
            runtime_dir: PathBuf::from("/app/Resources/runtime"),
            worker: PathBuf::from("/app/Resources/desktop-worker/index.js"),
            template_dir: PathBuf::from("/app/Resources/templates"),
        };
        let toolchain = Path::new("/app-data/toolchain");

        assert_eq!(
            resolve_tool_from_paths(
                "node",
                &resources,
                toolchain,
                DesktopMode::Production,
                false
            ),
            ResolvedCommand {
                command: "/app/Resources/runtime/node/bin/node".to_string(),
                args: vec![],
            }
        );
        assert_eq!(
            resolve_tool_from_paths("pnpm", &resources, toolchain, DesktopMode::Production, true),
            ResolvedCommand {
                command: "/app/Resources/runtime/node/node.exe".to_string(),
                args: vec!["/app-data/toolchain/node_modules/pnpm/bin/pnpm.cjs".to_string()],
            }
        );
        assert_eq!(
            resolve_tool_from_paths("gh", &resources, toolchain, DesktopMode::Production, true),
            ResolvedCommand {
                command: "/app/Resources/runtime/gh/gh.exe".to_string(),
                args: vec![],
            }
        );
    }

    #[test]
    fn development_tools_can_fall_back_to_the_inherited_path() {
        let resources = DesktopResourcePaths {
            runtime_dir: PathBuf::from("/missing/runtime"),
            worker: PathBuf::from("/repo/dist/desktop-worker/index.js"),
            template_dir: PathBuf::from("/repo/dist/templates"),
        };
        let toolchain = Path::new("/missing/toolchain");

        assert_eq!(
            resolve_tool_from_paths(
                "node",
                &resources,
                toolchain,
                DesktopMode::Development,
                false
            ),
            ResolvedCommand {
                command: "node".to_string(),
                args: vec![]
            }
        );
        assert_eq!(
            resolve_tool_from_paths(
                "pnpm",
                &resources,
                toolchain,
                DesktopMode::Development,
                false
            ),
            ResolvedCommand {
                command: "pnpm".to_string(),
                args: vec![]
            }
        );
    }
}
