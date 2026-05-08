/// Error type bridged into Tauri commands. The Serialize impl converts the
/// error into a plain string the frontend can render.
#[derive(Debug, thiserror::Error)]
pub enum AgentError {
    #[error("not enrolled")]
    NotEnrolled,
    #[error("network error: {0}")]
    Network(String),
    #[error("server error ({status}): {message}")]
    Server { status: u16, message: String },
    #[error("storage error: {0}")]
    Storage(String),
    #[error("internal: {0}")]
    Internal(String),
}

impl serde::Serialize for AgentError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<rusqlite::Error> for AgentError {
    fn from(e: rusqlite::Error) -> Self {
        AgentError::Storage(e.to_string())
    }
}

impl From<reqwest::Error> for AgentError {
    fn from(e: reqwest::Error) -> Self {
        AgentError::Network(e.to_string())
    }
}

impl From<serde_json::Error> for AgentError {
    fn from(e: serde_json::Error) -> Self {
        AgentError::Internal(format!("serde: {e}"))
    }
}

impl From<keyring::Error> for AgentError {
    fn from(e: keyring::Error) -> Self {
        AgentError::Storage(format!("keyring: {e}"))
    }
}

impl From<anyhow::Error> for AgentError {
    fn from(e: anyhow::Error) -> Self {
        AgentError::Internal(e.to_string())
    }
}

pub type AgentResult<T> = Result<T, AgentError>;
