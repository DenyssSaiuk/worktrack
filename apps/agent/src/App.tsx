import { useEffect, useState } from 'react';

import { EnrollScreen } from './components/EnrollScreen.js';
import { StatusScreen } from './components/StatusScreen.js';
import { agent, type AgentStatus } from './lib/tauri.js';

export function App(): JSX.Element {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void agent
      .status()
      .then(setStatus)
      .catch((err) => setError((err as Error).message));
    const unlistenPromise = agent.onStatusChange(setStatus);
    return () => {
      unlistenPromise.then((un) => un()).catch(() => undefined);
    };
  }, []);

  if (error) {
    return (
      <div className="flex h-full flex-1 items-center justify-center p-8 text-red-700">
        Could not reach the local agent: {error}
      </div>
    );
  }

  if (!status) {
    return <div className="flex h-full flex-1 items-center justify-center p-8">Loading…</div>;
  }

  if (!status.enrolled) {
    return <EnrollScreen onDone={() => void agent.status().then(setStatus)} />;
  }

  return <StatusScreen status={status} onLogout={() => void agent.logout()} />;
}
