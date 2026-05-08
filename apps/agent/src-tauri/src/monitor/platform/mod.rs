//! OS abstraction. Today the implementation uses cross-platform crates
//! (`active-win-pos-rs`, `user-idle`) which work on Windows, macOS and Linux.
//! This module is structured behind functions so a per-OS native swap is a
//! drop-in replacement (e.g. Win32 `GetForegroundWindow` /
//! `GetLastInputInfo`).

use std::path::Path;

use anyhow::Result;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct WindowInfo {
    pub process_name: String,
    pub process_path: Option<String>,
    pub title: String,
    pub pid: Option<u32>,
}

pub fn active_window() -> Result<Option<WindowInfo>> {
    match active_win_pos_rs::get_active_window() {
        Ok(w) => {
            let path = w.process_path.to_string_lossy().into_owned();
            let process_name = Path::new(&path)
                .file_name()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_else(|| path.clone());
            Ok(Some(WindowInfo {
                process_name,
                process_path: Some(path),
                title: truncate(w.title, 480),
                pid: u32::try_from(w.process_id).ok(),
            }))
        }
        Err(()) => Ok(None),
    }
}

pub fn idle_seconds() -> Result<u64> {
    let idle = user_idle::UserIdle::get_time().map_err(|e| anyhow::anyhow!("idle: {e}"))?;
    Ok(idle.as_seconds())
}

fn truncate(s: String, n: usize) -> String {
    if s.chars().count() <= n {
        s
    } else {
        s.chars().take(n).collect()
    }
}
