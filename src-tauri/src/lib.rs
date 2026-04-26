use std::path::{Path, PathBuf};

use tauri::Manager;

pub mod app_state;
pub mod commands;
pub mod db;
pub mod domain;
pub mod repositories;
pub mod runner;

const APP_DATA_FOLDER: &str = "workflow-automation-manager";

#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

fn resolve_app_data_dir(base_dir: &Path) -> PathBuf {
    base_dir.join(APP_DATA_FOLDER)
}

#[tauri::command]
fn app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    let base_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;

    Ok(resolve_app_data_dir(&base_dir).display().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let base_dir = app
                .path()
                .app_data_dir()
                .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
            let app_dir = resolve_app_data_dir(&base_dir);
            std::fs::create_dir_all(&app_dir)
                .map_err(|error| format!("Failed to create app data directory: {error}"))?;

            let db_path = app_dir.join("database.sqlite");
            let state =
                tauri::async_runtime::block_on(app_state::AppState::initialize(&db_path))
                    .map_err(|error| format!("Failed to initialize application state: {error}"))?;
            app.manage(state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            app_data_dir,
            commands::list_workflows,
            commands::create_workflow,
            commands::get_workflow,
            commands::rename_workflow,
            commands::delete_workflow,
            commands::add_step,
            commands::update_step,
            commands::delete_step,
            commands::reorder_steps,
            commands::get_run_state,
            commands::run_workflow,
            commands::test_step,
            commands::stop_run,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn ping_returns_pong() {
        assert_eq!(ping(), "pong");
    }

    #[test]
    fn app_data_dir_uses_stable_app_folder() {
        let base = PathBuf::from("/tmp/automation-app-test");

        let app_dir = resolve_app_data_dir(&base);

        assert_eq!(app_dir, base.join("workflow-automation-manager"));
    }
}
