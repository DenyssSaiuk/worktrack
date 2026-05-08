//! Activity monitor. Polls the active window and idle timer once per second
//! and emits events to the buffer. **Privacy invariant**: nothing is
//! collected outside `workday_active` AND outside a private session.

use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use serde_json::json;
use tracing::warn;
use uuid::Uuid;

use crate::config::{IDLE_THRESHOLD_SECONDS, POLL_INTERVAL_MS};
use crate::state::AppState;

mod platform;

pub fn spawn(state: Arc<AppState>) {
    tokio::spawn(async move {
        let mut last_window: Option<String> = None;
        let mut idle = false;
        let mut idle_started: Option<i64> = None;

        let mut tick = tokio::time::interval(Duration::from_millis(POLL_INTERVAL_MS));
        loop {
            tick.tick().await;

            // Privacy gate: don't even read the OS while the user is offline,
            // outside their workday, or in a private session.
            if !state.is_collecting() {
                last_window = None;
                idle = false;
                idle_started = None;
                continue;
            }

            // Active window snapshot.
            match platform::active_window() {
                Ok(Some(w)) => {
                    let key = format!("{}|{}", w.process_name, w.title);
                    if last_window.as_deref() != Some(&key) {
                        last_window = Some(key);
                        let payload = json!({
                            "processName": w.process_name,
                            "processPath": w.process_path,
                            "windowTitle": w.title,
                            "pid": w.pid,
                        });
                        state.append_event("window_focus", payload);
                    }
                }
                Ok(None) => {}
                Err(e) => warn!("active_window failed: {e}"),
            }

            // Idle detection.
            match platform::idle_seconds() {
                Ok(secs) => {
                    let now_ms = Utc::now().timestamp_millis();
                    if !idle && secs >= IDLE_THRESHOLD_SECONDS {
                        idle = true;
                        idle_started = Some(now_ms);
                        state.append_event(
                            "idle_start",
                            json!({ "idleThresholdSeconds": IDLE_THRESHOLD_SECONDS }),
                        );
                    } else if idle && secs < IDLE_THRESHOLD_SECONDS {
                        idle = false;
                        let started = idle_started.take().unwrap_or(now_ms);
                        let duration = ((now_ms - started) / 1000).max(0) as u64;
                        state.append_event("idle_end", json!({ "idleDurationSeconds": duration }));
                    }
                }
                Err(e) => warn!("idle_seconds failed: {e}"),
            }
        }
    });
}

#[allow(dead_code)]
pub fn new_event_id() -> String {
    Uuid::new_v4().to_string()
}
