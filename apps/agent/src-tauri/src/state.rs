use std::path::PathBuf;
use std::sync::Arc;

use chrono::Utc;
use parking_lot::Mutex;
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};
use tracing::warn;
use uuid::Uuid;

use crate::buffer::{Buffer, BufferedEvent};
use crate::config::EnrolledIdentity;
use crate::error::AgentResult;
use crate::keychain;

#[derive(Debug, Clone, Serialize)]
pub struct AgentStatus {
    pub enrolled: bool,
    #[serde(rename = "loggedIn")]
    pub logged_in: bool,
    #[serde(rename = "workdayActive")]
    pub workday_active: bool,
    #[serde(rename = "inPrivateSession")]
    pub in_private_session: bool,
    pub online: bool,
    pub hostname: String,
    #[serde(rename = "agentVersion")]
    pub agent_version: String,
    #[serde(rename = "bufferedEventCount")]
    pub buffered_event_count: u64,
    #[serde(rename = "serverUrl")]
    pub server_url: String,
}

struct Inner {
    identity: Option<EnrolledIdentity>,
    workday_active: bool,
    in_private_session: bool,
    online: bool,
    pending_client_session_id: Option<String>,
    workday_started_at: Option<String>,
    session_id: Option<String>,
    buffered_event_count: u64,
}

pub struct AppState {
    inner: Mutex<Inner>,
    buffer: Arc<Buffer>,
    handle: AppHandle,
    hostname: String,
}

impl AppState {
    pub fn initialize(handle: AppHandle) -> AgentResult<Self> {
        let mut data_dir: PathBuf = handle
            .path()
            .app_data_dir()
            .map_err(|e| crate::error::AgentError::Storage(format!("app_data_dir: {e}")))?;
        std::fs::create_dir_all(&data_dir)
            .map_err(|e| crate::error::AgentError::Storage(format!("mkdir: {e}")))?;
        data_dir.push("buffer.sqlite");

        let buffer = Arc::new(Buffer::open(&data_dir)?);
        let identity = match keychain::load() {
            Ok(v) => v,
            Err(e) => {
                warn!("failed to load identity from keychain: {e}");
                None
            }
        };

        let buffered = buffer.unsynced_count().unwrap_or(0).max(0) as u64;

        let hostname = sysinfo::System::host_name().unwrap_or_else(|| "unknown".into());

        Ok(Self {
            inner: Mutex::new(Inner {
                identity,
                workday_active: false,
                in_private_session: false,
                online: false,
                pending_client_session_id: None,
                workday_started_at: None,
                session_id: None,
                buffered_event_count: buffered,
            }),
            buffer,
            handle,
            hostname,
        })
    }

    pub fn buffer(&self) -> Arc<Buffer> {
        self.buffer.clone()
    }

    pub fn identity(&self) -> Option<EnrolledIdentity> {
        self.inner.lock().identity.clone()
    }

    pub fn set_identity(&self, identity: Option<EnrolledIdentity>) -> AgentResult<()> {
        match &identity {
            Some(i) => keychain::save(i)?,
            None => keychain::clear()?,
        }
        self.inner.lock().identity = identity;
        self.emit();
        Ok(())
    }

    pub fn workday_active(&self) -> bool {
        self.inner.lock().workday_active
    }

    pub fn workday_started_at(&self) -> Option<String> {
        self.inner.lock().workday_started_at.clone()
    }

    pub fn pending_client_session_id(&self) -> Option<String> {
        self.inner.lock().pending_client_session_id.clone()
    }

    pub fn session_id(&self) -> Option<String> {
        self.inner.lock().session_id.clone()
    }

    pub fn set_session_id(&self, id: Option<String>) {
        self.inner.lock().session_id = id;
        self.emit();
    }

    pub fn in_private_session(&self) -> bool {
        self.inner.lock().in_private_session
    }

    pub fn set_online(&self, online: bool) {
        let mut g = self.inner.lock();
        if g.online == online {
            return;
        }
        g.online = online;
        drop(g);
        self.emit();
    }

    pub fn buffered_event_count(&self) -> u64 {
        self.inner.lock().buffered_event_count
    }

    pub fn refresh_buffered_count(&self) {
        let n = self.buffer.unsynced_count().unwrap_or(0).max(0) as u64;
        self.inner.lock().buffered_event_count = n;
        self.emit();
    }

    pub fn is_collecting(&self) -> bool {
        let g = self.inner.lock();
        g.identity.is_some() && g.workday_active && !g.in_private_session
    }

    pub fn start_workday(&self) {
        {
            let mut g = self.inner.lock();
            if g.workday_active {
                return;
            }
            g.workday_active = true;
            g.in_private_session = false;
            g.workday_started_at = Some(Utc::now().to_rfc3339());
            g.pending_client_session_id = Some(Uuid::new_v4().to_string());
            g.session_id = None;
        }
        self.emit();
    }

    pub fn end_workday(&self) {
        {
            let mut g = self.inner.lock();
            g.workday_active = false;
            g.in_private_session = false;
            g.session_id = None;
            g.pending_client_session_id = None;
            g.workday_started_at = None;
        }
        self.emit();
    }

    pub fn toggle_private(&self) -> bool {
        let new_state;
        let event_payload;
        {
            let mut g = self.inner.lock();
            g.in_private_session = !g.in_private_session;
            new_state = g.in_private_session;
            event_payload = if new_state {
                "private_start"
            } else {
                "private_end"
            };
        }
        // Record the start/stop boundary itself (even though no payload data
        // is collected during the private window).
        self.append_event(event_payload, serde_json::json!({}));
        self.emit();
        new_state
    }

    pub fn append_event(&self, event_type: &str, payload: Value) {
        let session_id = self.session_id();
        let evt = BufferedEvent {
            id: 0,
            session_id: session_id.clone(),
            client_event_id: Uuid::new_v4().to_string(),
            timestamp_ms: Utc::now().timestamp_millis(),
            event_type: event_type.to_string(),
            payload_json: payload.to_string(),
        };
        if let Err(e) = self.buffer.append(&evt) {
            warn!("failed to append event {event_type}: {e}");
            return;
        }
        let n = self.buffer.unsynced_count().unwrap_or(0).max(0) as u64;
        self.inner.lock().buffered_event_count = n;
        self.emit();
    }

    pub fn snapshot(&self) -> AgentStatus {
        let g = self.inner.lock();
        AgentStatus {
            enrolled: g.identity.is_some(),
            logged_in: g.identity.is_some(),
            workday_active: g.workday_active,
            in_private_session: g.in_private_session,
            online: g.online,
            hostname: self.hostname.clone(),
            agent_version: env!("CARGO_PKG_VERSION").to_string(),
            buffered_event_count: g.buffered_event_count,
            server_url: g
                .identity
                .as_ref()
                .map(|i| i.server_url.clone())
                .unwrap_or_default(),
        }
    }

    pub fn emit(&self) {
        let snap = self.snapshot();
        if let Err(e) = self.handle.emit("agent://status", snap) {
            warn!("emit status failed: {e}");
        }
    }
}
