//! Background sync loop. Every ~30s while online and a session is active,
//! flush buffered events to the server. Heartbeat every 60s.

pub mod api;

use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use reqwest::header::AUTHORIZATION;
use serde::{Deserialize, Serialize};
use tracing::{debug, info, warn};

use crate::config::{BATCH_SIZE, HEARTBEAT_INTERVAL_MS, SYNC_INTERVAL_MS};
use crate::error::{AgentError, AgentResult};
use crate::state::AppState;

#[derive(Serialize)]
struct EventBatchPayload<'a> {
    #[serde(rename = "sessionId")]
    session_id: &'a str,
    events: Vec<EventEnvelope<'a>>,
}

#[derive(Serialize)]
struct EventEnvelope<'a> {
    #[serde(rename = "clientEventId")]
    client_event_id: &'a str,
    timestamp: String,
    #[serde(rename = "type")]
    event_type: &'a str,
    payload: serde_json::Value,
}

#[derive(Deserialize)]
struct EventBatchResponse {
    accepted: u32,
    duplicates: u32,
    rejected: u32,
}

pub fn spawn(state: Arc<AppState>) {
    let s = state.clone();
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(Duration::from_millis(SYNC_INTERVAL_MS));
        loop {
            tick.tick().await;
            if let Err(e) = sync_once(&s).await {
                warn!("sync failed: {e}");
                s.set_online(false);
            }
        }
    });

    let s = state;
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(Duration::from_millis(HEARTBEAT_INTERVAL_MS));
        loop {
            tick.tick().await;
            if let Err(e) = heartbeat_once(&s).await {
                debug!("heartbeat failed: {e}");
            }
        }
    });
}

async fn sync_once(state: &Arc<AppState>) -> AgentResult<()> {
    let identity = match state.identity() {
        Some(i) => i,
        None => return Ok(()),
    };

    // Push pending session start, if any.
    if state.workday_active() {
        ensure_session_started(state, &identity).await?;
    }

    let session_id = match state.session_id() {
        Some(s) => s,
        None => return Ok(()),
    };

    let buffer = state.buffer();
    let batch = buffer.take_batch(&session_id, BATCH_SIZE)?;
    if batch.is_empty() {
        state.set_online(true);
        return Ok(());
    }

    let envelopes: Vec<EventEnvelope> = batch
        .iter()
        .map(|e| EventEnvelope {
            client_event_id: &e.client_event_id,
            timestamp: chrono::DateTime::<Utc>::from_timestamp_millis(e.timestamp_ms)
                .unwrap_or_else(Utc::now)
                .to_rfc3339(),
            event_type: &e.event_type,
            payload: serde_json::from_str(&e.payload_json).unwrap_or(serde_json::Value::Null),
        })
        .collect();

    let url = format!("{}/api/v1/ingest/events", identity.server_url);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()?;

    let resp = client
        .post(&url)
        .header(AUTHORIZATION, format!("Bearer {}", identity.agent_token))
        .json(&EventBatchPayload {
            session_id: &session_id,
            events: envelopes,
        })
        .send()
        .await?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        return Err(AgentError::Server {
            status,
            message: body,
        });
    }

    let result: EventBatchResponse = resp.json().await?;
    info!(
        "sync ok: accepted={} duplicates={} rejected={}",
        result.accepted, result.duplicates, result.rejected
    );

    let ids: Vec<i64> = batch.iter().map(|e| e.id).collect();
    buffer.mark_synced(&ids)?;
    state.set_online(true);
    state.refresh_buffered_count();
    Ok(())
}

async fn ensure_session_started(
    state: &Arc<AppState>,
    identity: &crate::config::EnrolledIdentity,
) -> AgentResult<()> {
    if state.session_id().is_some() {
        return Ok(());
    }

    let client_session_id = state
        .pending_client_session_id()
        .ok_or_else(|| AgentError::Internal("workday active but no client session id".into()))?;

    let url = format!("{}/api/v1/ingest/session/start", identity.server_url);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()?;

    #[derive(Serialize)]
    struct Body<'a> {
        #[serde(rename = "clientSessionId")]
        client_session_id: &'a str,
        #[serde(rename = "startedAt")]
        started_at: String,
    }
    #[derive(Deserialize)]
    struct Resp {
        #[serde(rename = "sessionId")]
        session_id: String,
    }

    let resp = client
        .post(&url)
        .header(AUTHORIZATION, format!("Bearer {}", identity.agent_token))
        .json(&Body {
            client_session_id: &client_session_id,
            started_at: state
                .workday_started_at()
                .unwrap_or_else(|| Utc::now().to_rfc3339()),
        })
        .send()
        .await?;

    if !resp.status().is_success() {
        return Err(AgentError::Server {
            status: resp.status().as_u16(),
            message: resp.text().await.unwrap_or_default(),
        });
    }

    let r: Resp = resp.json().await?;
    state.set_session_id(Some(r.session_id));
    Ok(())
}

async fn heartbeat_once(state: &Arc<AppState>) -> AgentResult<()> {
    let identity = match state.identity() {
        Some(i) => i,
        None => return Ok(()),
    };

    let url = format!("{}/api/v1/ingest/heartbeat", identity.server_url);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()?;

    #[derive(Serialize)]
    struct Body {
        timestamp: String,
        #[serde(rename = "agentVersion")]
        agent_version: String,
        #[serde(rename = "inPrivateSession")]
        in_private_session: bool,
        #[serde(rename = "bufferedEventCount")]
        buffered_event_count: u64,
        #[serde(rename = "sessionId", skip_serializing_if = "Option::is_none")]
        session_id: Option<String>,
    }

    let resp = client
        .post(&url)
        .header(AUTHORIZATION, format!("Bearer {}", identity.agent_token))
        .json(&Body {
            timestamp: Utc::now().to_rfc3339(),
            agent_version: env!("CARGO_PKG_VERSION").to_string(),
            in_private_session: state.in_private_session(),
            buffered_event_count: state.buffered_event_count(),
            session_id: state.session_id(),
        })
        .send()
        .await?;

    state.set_online(resp.status().is_success());
    Ok(())
}
