use serde::{Deserialize, Serialize};

pub const POLL_INTERVAL_MS: u64 = 1_000;
pub const SYNC_INTERVAL_MS: u64 = 30_000;
pub const HEARTBEAT_INTERVAL_MS: u64 = 60_000;
pub const IDLE_THRESHOLD_SECONDS: u64 = 60;
pub const BATCH_SIZE: usize = 500;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnrolledIdentity {
    pub server_url: String,
    pub agent_token: String,
    pub device_id: String,
    pub user_id: String,
    pub organization_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WorkScheduleSnapshot {
    pub timezone: String,
    pub hours: std::collections::BTreeMap<String, ScheduleWindow>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ScheduleWindow {
    pub start: String,
    pub end: String,
}
