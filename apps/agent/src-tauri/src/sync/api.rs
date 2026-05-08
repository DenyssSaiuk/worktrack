//! HTTP helpers used by the enroll and lifecycle commands. Sync loop has its
//! own helpers in `super::mod`; we keep this thin layer for one-shot calls.

use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::config::EnrolledIdentity;
use crate::error::{AgentError, AgentResult};

#[derive(Serialize)]
struct EnrollBody<'a> {
    #[serde(rename = "enrollToken")]
    enroll_token: &'a str,
    hostname: String,
    os: String,
    #[serde(rename = "agentVersion")]
    agent_version: String,
}

#[derive(Deserialize)]
struct EnrollResp {
    #[serde(rename = "agentToken")]
    agent_token: String,
    #[serde(rename = "deviceId")]
    device_id: String,
    #[serde(rename = "userId")]
    user_id: String,
    #[serde(rename = "organizationId")]
    organization_id: String,
}

pub async fn enroll(server_url: &str, enroll_token: &str) -> AgentResult<EnrolledIdentity> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()?;

    let hostname = sysinfo::System::host_name().unwrap_or_else(|| "unknown".into());
    let os = format!("{}-{}", std::env::consts::OS, std::env::consts::ARCH);

    let resp = client
        .post(format!("{server_url}/api/v1/auth/agent/enroll"))
        .json(&EnrollBody {
            enroll_token,
            hostname,
            os,
            agent_version: env!("CARGO_PKG_VERSION").to_string(),
        })
        .send()
        .await?;

    if !resp.status().is_success() {
        return Err(AgentError::Server {
            status: resp.status().as_u16(),
            message: resp.text().await.unwrap_or_default(),
        });
    }

    let body: EnrollResp = resp.json().await?;
    Ok(EnrolledIdentity {
        server_url: server_url.trim_end_matches('/').to_string(),
        agent_token: body.agent_token,
        device_id: body.device_id,
        user_id: body.user_id,
        organization_id: body.organization_id,
    })
}

pub async fn end_session_remote(identity: &EnrolledIdentity, session_id: &str) -> AgentResult<()> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()?;

    #[derive(Serialize)]
    struct Body<'a> {
        #[serde(rename = "sessionId")]
        session_id: &'a str,
        #[serde(rename = "endedAt")]
        ended_at: String,
        #[serde(rename = "privateMinutes")]
        private_minutes: u32,
    }

    let resp = client
        .post(format!("{}/api/v1/ingest/session/end", identity.server_url))
        .header(
            reqwest::header::AUTHORIZATION,
            format!("Bearer {}", identity.agent_token),
        )
        .json(&Body {
            session_id,
            ended_at: chrono::Utc::now().to_rfc3339(),
            private_minutes: 0,
        })
        .send()
        .await?;

    if !resp.status().is_success() {
        return Err(AgentError::Server {
            status: resp.status().as_u16(),
            message: resp.text().await.unwrap_or_default(),
        });
    }
    Ok(())
}
