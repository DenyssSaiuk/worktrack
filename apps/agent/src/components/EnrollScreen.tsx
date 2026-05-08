import { useState } from 'react';

import { agent } from '../lib/tauri.js';

export function EnrollScreen({ onDone }: { onDone: () => void }): JSX.Element {
  const [serverUrl, setServerUrl] = useState('http://localhost:4000');
  const [enrollToken, setEnrollToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await agent.enrollAndLogin(serverUrl, enrollToken.trim());
      onDone();
    } catch (err) {
      setError((err as Error).message ?? 'Enrollment failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-1 items-center justify-center p-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-2xl bg-white p-8 shadow-md"
      >
        <header>
          <h1 className="text-2xl font-semibold">Enroll WorkTrack Agent</h1>
          <p className="mt-2 text-sm text-slate-500">
            Ask your IT admin for a one-time enrollment token. The agent will start collecting
            activity only after you press <strong>Start Workday</strong>.
          </p>
        </header>

        <label className="block">
          <span className="text-sm font-medium">Server URL</span>
          <input
            type="url"
            required
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 focus:border-brand-500 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Enrollment token</span>
          <input
            type="text"
            required
            autoComplete="off"
            spellCheck={false}
            value={enrollToken}
            onChange={(e) => setEnrollToken(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm focus:border-brand-500 focus:outline-none"
          />
        </label>

        {error && (
          <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-brand-500 px-4 py-2 font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Enrolling…' : 'Enroll'}
        </button>

        <p className="text-xs text-slate-400">
          By enrolling, you acknowledge your organization&rsquo;s monitoring policy. The agent runs
          only during scheduled work hours and pauses entirely during private sessions.
        </p>
      </form>
    </div>
  );
}
