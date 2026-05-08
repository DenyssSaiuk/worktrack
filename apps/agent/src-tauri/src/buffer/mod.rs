//! Local SQLite buffer for unsynced events. The agent writes here from the
//! monitor thread and the sync thread reads/marks-as-sent. Cleared events
//! older than the retention bound are dropped lazily.

use std::path::Path;

use parking_lot::Mutex;
use rusqlite::{params, Connection};

use crate::error::AgentResult;

#[derive(Debug, Clone)]
pub struct BufferedEvent {
    pub id: i64,
    pub session_id: Option<String>,
    pub client_event_id: String,
    pub timestamp_ms: i64,
    pub event_type: String,
    pub payload_json: String,
}

pub struct Buffer {
    conn: Mutex<Connection>,
}

impl Buffer {
    pub fn open(path: &Path) -> AgentResult<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                client_event_id TEXT NOT NULL UNIQUE,
                timestamp_ms INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                synced INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
            );
            CREATE INDEX IF NOT EXISTS idx_events_synced_id ON events(synced, id);
            CREATE INDEX IF NOT EXISTS idx_events_session_synced ON events(session_id, synced);

            CREATE TABLE IF NOT EXISTS kv (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            ",
        )?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn append(&self, evt: &BufferedEvent) -> AgentResult<()> {
        let conn = self.conn.lock();
        conn.execute(
            "INSERT OR IGNORE INTO events
              (session_id, client_event_id, timestamp_ms, event_type, payload_json, synced)
             VALUES (?1, ?2, ?3, ?4, ?5, 0)",
            params![
                evt.session_id,
                evt.client_event_id,
                evt.timestamp_ms,
                evt.event_type,
                evt.payload_json,
            ],
        )?;
        Ok(())
    }

    pub fn unsynced_count(&self) -> AgentResult<i64> {
        let conn = self.conn.lock();
        let n: i64 = conn.query_row("SELECT COUNT(*) FROM events WHERE synced = 0", [], |row| {
            row.get(0)
        })?;
        Ok(n)
    }

    pub fn take_batch(&self, session_id: &str, limit: usize) -> AgentResult<Vec<BufferedEvent>> {
        let conn = self.conn.lock();
        let mut stmt = conn.prepare(
            "SELECT id, session_id, client_event_id, timestamp_ms, event_type, payload_json
             FROM events
             WHERE synced = 0 AND session_id = ?1
             ORDER BY id ASC
             LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![session_id, limit as i64], |r| {
            Ok(BufferedEvent {
                id: r.get(0)?,
                session_id: r.get(1)?,
                client_event_id: r.get(2)?,
                timestamp_ms: r.get(3)?,
                event_type: r.get(4)?,
                payload_json: r.get(5)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn mark_synced(&self, ids: &[i64]) -> AgentResult<()> {
        if ids.is_empty() {
            return Ok(());
        }
        let conn = self.conn.lock();
        let placeholders = vec!["?"; ids.len()].join(",");
        let sql = format!("UPDATE events SET synced = 1 WHERE id IN ({placeholders})");
        let params_vec: Vec<&dyn rusqlite::ToSql> =
            ids.iter().map(|i| i as &dyn rusqlite::ToSql).collect();
        conn.execute(&sql, params_vec.as_slice())?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn purge_synced_older_than(&self, retention_ms: i64) -> AgentResult<usize> {
        let conn = self.conn.lock();
        let cutoff = chrono::Utc::now().timestamp_millis() - retention_ms;
        let n = conn.execute(
            "DELETE FROM events WHERE synced = 1 AND created_at < ?1",
            params![cutoff],
        )?;
        Ok(n)
    }

    /// Generic key-value store, used by the agent to remember small bits of
    /// state (e.g. last-known sessionId) between restarts.
    #[allow(dead_code)]
    pub fn kv_set(&self, key: &str, value: &str) -> AgentResult<()> {
        let conn = self.conn.lock();
        conn.execute(
            "INSERT INTO kv(key, value) VALUES(?1, ?2)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn kv_get(&self, key: &str) -> AgentResult<Option<String>> {
        let conn = self.conn.lock();
        let v: Option<String> = conn
            .query_row("SELECT value FROM kv WHERE key = ?1", params![key], |row| {
                row.get(0)
            })
            .ok();
        Ok(v)
    }
}
