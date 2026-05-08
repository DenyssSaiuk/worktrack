use std::sync::Arc;

use tauri::State;

use crate::error::{AgentError, AgentResult};
use crate::state::{AgentStatus, AppState};
use crate::sync::api;

#[tauri::command]
pub fn agent_status(state: State<'_, Arc<AppState>>) -> AgentStatus {
    state.snapshot()
}

#[tauri::command]
pub async fn agent_enroll(
    state: State<'_, Arc<AppState>>,
    server_url: String,
    enroll_token: String,
) -> AgentResult<()> {
    let identity = api::enroll(&server_url, &enroll_token).await?;
    state.set_identity(Some(identity))?;
    Ok(())
}

#[tauri::command]
pub fn agent_start_workday(state: State<'_, Arc<AppState>>) -> AgentResult<()> {
    if state.identity().is_none() {
        return Err(AgentError::NotEnrolled);
    }
    state.start_workday();
    Ok(())
}

#[tauri::command]
pub async fn agent_end_workday(state: State<'_, Arc<AppState>>) -> AgentResult<()> {
    let identity = state.identity().ok_or(AgentError::NotEnrolled)?;
    let session_id = state.session_id();
    state.end_workday();
    if let Some(sid) = session_id {
        // Best-effort: if offline this will be retried on next sync.
        let _ = api::end_session_remote(&identity, &sid).await;
    }
    Ok(())
}

#[tauri::command]
pub fn agent_toggle_private(state: State<'_, Arc<AppState>>) -> AgentResult<bool> {
    if state.identity().is_none() {
        return Err(AgentError::NotEnrolled);
    }
    Ok(state.toggle_private())
}

#[tauri::command]
pub fn agent_logout(state: State<'_, Arc<AppState>>) -> AgentResult<()> {
    state.end_workday();
    state.set_identity(None)?;
    Ok(())
}
