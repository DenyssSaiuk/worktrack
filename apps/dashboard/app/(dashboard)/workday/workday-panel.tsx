'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface WorkdayStatus {
  active: boolean;
  sessionId?: string;
  startedAt?: string;
  deviceId?: string;
}

const HEARTBEAT_MS = 30_000;

function formatElapsed(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  if (ms < 0) return '0:00:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function WorkdayPanel({
  initial,
  userFullName,
}: {
  initial: WorkdayStatus;
  userFullName: string;
}) {
  const [status, setStatus] = useState<WorkdayStatus>(initial);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1-second ticker drives the elapsed-time readout.
  useEffect(() => {
    if (!status.active) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [status.active]);

  const sendHeartbeat = useCallback(async () => {
    try {
      await fetch('/api/proxy/me/heartbeat', { method: 'POST' });
    } catch {
      /* ignore — best-effort */
    }
  }, []);

  // Heartbeat loop only while active and the tab is visible.
  useEffect(() => {
    if (!status.active) {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      return;
    }
    void sendHeartbeat();
    heartbeatRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') void sendHeartbeat();
    }, HEARTBEAT_MS);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [status.active, sendHeartbeat]);

  async function start(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy/me/workday/start', { method: 'POST' });
      if (!res.ok) throw new Error(`Failed to start (${res.status})`);
      const next = (await res.json()) as WorkdayStatus;
      setStatus({ ...next, active: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function stop(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy/me/workday/end', { method: 'POST' });
      if (!res.ok) throw new Error(`Failed to stop (${res.status})`);
      setStatus({ active: false });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="card lg:col-span-2">
        <div className="flex items-center gap-3">
          <span
            className={`inline-block h-3 w-3 rounded-full ${
              status.active ? 'animate-pulse bg-green-500' : 'bg-slate-300'
            }`}
          />
          <h2 className="text-lg font-medium">
            {status.active ? 'Tracking your workday' : 'Workday not started'}
          </h2>
        </div>

        {status.active && status.startedAt ? (
          <div className="mt-6">
            <div className="text-5xl font-mono tabular-nums tracking-tight">
              {/* read `tick` so React re-renders every second */}
              <span data-tick={tick}>{formatElapsed(status.startedAt)}</span>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Started at{' '}
              {new Date(status.startedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              · session <span className="font-mono">{status.sessionId?.slice(0, 12)}…</span>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            Press <strong>Start Workday</strong> below to begin. Activity is collected only while
            the workday is active.
          </p>
        )}

        {error && <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="mt-6 flex gap-2">
          {!status.active ? (
            <button
              onClick={() => void start()}
              disabled={busy}
              className="btn-primary"
              type="button"
            >
              {busy ? 'Starting…' : 'Start Workday'}
            </button>
          ) : (
            <button
              onClick={() => void stop()}
              disabled={busy}
              className="btn-secondary"
              type="button"
            >
              {busy ? 'Stopping…' : 'Stop Workday'}
            </button>
          )}
        </div>
      </div>

      <aside className="card space-y-3 text-sm text-slate-600">
        <h3 className="text-sm font-medium text-slate-900">How tracking works</h3>
        <p>
          When your workday is active, the dashboard sends a heartbeat to the server every 30
          seconds so your manager can see that you are online.
        </p>
        <p>
          If you install the <strong>WorkTrack browser extension</strong>, it will also send the
          domains and page titles of the tabs you focus to your current workday session.
        </p>
        <p>
          Stopping the workday immediately closes the session. Nothing is collected while it is
          stopped.
        </p>
        <p className="text-xs text-slate-400">Signed in as {userFullName}.</p>
      </aside>
    </div>
  );
}
