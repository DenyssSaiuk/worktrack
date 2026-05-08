'use client';

import { useState } from 'react';

export function ReportsForm() {
  const [from, setFrom] = useState(
    new Date(Date.now() - 7 * 24 * 3600_000).toISOString().slice(0, 10),
  );
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [includeScreenshots, setIncludeScreenshots] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy/exports/excel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          from: new Date(`${from}T00:00:00Z`).toISOString(),
          to: new Date(`${to}T23:59:59Z`).toISOString(),
          includeScreenshots,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? `${res.status}`);
      }
      const body = (await res.json()) as { jobId: string };
      setJobId(body.jobId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card max-w-xl space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="text-xs uppercase tracking-wide text-slate-500">From</span>
          <input
            type="date"
            className="input mt-1"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          <span className="text-xs uppercase tracking-wide text-slate-500">To</span>
          <input
            type="date"
            className="input mt-1"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={includeScreenshots}
          onChange={(e) => setIncludeScreenshots(e.target.checked)}
        />
        Include screenshot index
      </label>
      <button type="button" className="btn-primary" onClick={() => void submit()} disabled={busy}>
        {busy ? 'Queueing…' : 'Generate Excel'}
      </button>
      {jobId && (
        <p className="text-sm text-slate-600">
          Export queued as job <code className="font-mono">{jobId}</code>. Watch the Reports list
          (coming in Phase 7) for the download link.
        </p>
      )}
      {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
