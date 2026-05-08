'use client';

import { useState } from 'react';

interface Initial {
  id: string;
  name: string;
  retentionDays: number;
  settings: Record<string, unknown>;
}

export function SettingsForm({ initial, canEdit }: { initial: Initial; canEdit: boolean }) {
  const [retentionDays, setRetentionDays] = useState(initial.retentionDays);
  const [screenshotsEnabled, setScreenshotsEnabled] = useState(
    (initial.settings.screenshotsEnabled as boolean) ?? false,
  );
  const [aiEnabled, setAiEnabled] = useState(
    (initial.settings.aiAnalysisEnabled as boolean) ?? false,
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(): Promise<void> {
    setBusy(true);
    try {
      const res = await fetch('/api/proxy/organizations/me', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          retentionDays,
          screenshotsEnabled,
          aiAnalysisEnabled: aiEnabled,
        }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setBusy(false);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="card max-w-xl space-y-4">
      <label className="block">
        <span className="text-xs uppercase tracking-wide text-slate-500">Retention (days)</span>
        <input
          type="number"
          min={7}
          max={365}
          className="input mt-1"
          value={retentionDays}
          onChange={(e) => setRetentionDays(Number(e.target.value))}
          disabled={!canEdit}
        />
        <p className="mt-1 text-xs text-slate-500">
          After this period, raw events are deleted; daily summaries remain.
        </p>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={screenshotsEnabled}
          onChange={(e) => setScreenshotsEnabled(e.target.checked)}
          disabled={!canEdit}
        />
        Enable trigger-based screenshots (opt-in, never interval-based)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={aiEnabled}
          onChange={(e) => setAiEnabled(e.target.checked)}
          disabled={!canEdit}
        />
        Enable AI analysis of screenshots
      </label>
      {canEdit && (
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void save()}>
          {busy ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
      )}
    </div>
  );
}
