use keyring::Entry;
use serde::{Deserialize, Serialize};

use crate::config::EnrolledIdentity;
use crate::error::{AgentError, AgentResult};

const SERVICE: &str = "com.worktrack.agent";
const KEY: &str = "identity";

/// On Windows the user-scope credential vault, on macOS the Keychain, on
/// Linux the libsecret-backed Secret Service. The whole `EnrolledIdentity`
/// (server URL + agent token + device id) is stored as a single JSON blob so
/// the OS-level access controls protect it as a unit.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Stored {
    identity: EnrolledIdentity,
}

pub fn save(identity: &EnrolledIdentity) -> AgentResult<()> {
    let entry = Entry::new(SERVICE, KEY)?;
    let blob = serde_json::to_string(&Stored {
        identity: identity.clone(),
    })?;
    entry.set_password(&blob)?;
    Ok(())
}

pub fn load() -> AgentResult<Option<EnrolledIdentity>> {
    let entry = Entry::new(SERVICE, KEY)?;
    match entry.get_password() {
        Ok(blob) => {
            let stored: Stored = serde_json::from_str(&blob)
                .map_err(|e| AgentError::Storage(format!("keychain blob corrupt: {e}")))?;
            Ok(Some(stored.identity))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AgentError::Storage(format!("keyring: {e}"))),
    }
}

pub fn clear() -> AgentResult<()> {
    let entry = Entry::new(SERVICE, KEY)?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(AgentError::Storage(format!("keyring delete: {e}"))),
    }
}
