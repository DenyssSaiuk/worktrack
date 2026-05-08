#![deny(unsafe_code)]
#![warn(clippy::all)]

mod buffer;
mod commands;
mod config;
mod error;
mod keychain;
mod monitor;
mod state;
mod sync;
mod tray;

use std::sync::Arc;

use tauri::Manager;
use tauri_plugin_autostart::MacosLauncher;
use tracing_subscriber::EnvFilter;

use crate::state::AppState;

#[allow(clippy::missing_panics_doc)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .with_target(false)
        .compact()
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let state = Arc::new(AppState::initialize(app.handle().clone())?);
            app.manage(state.clone());

            tray::install(app, state.clone())?;
            sync::spawn(state.clone());
            monitor::spawn(state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::agent_status,
            commands::agent_enroll,
            commands::agent_start_workday,
            commands::agent_end_workday,
            commands::agent_toggle_private,
            commands::agent_logout,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
