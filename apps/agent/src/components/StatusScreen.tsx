import { agent, type AgentStatus } from '../lib/tauri.js';

interface Props {
  status: AgentStatus;
  onLogout: () => void;
}

export function StatusScreen({ status, onLogout }: Props): JSX.Element {
  return (
    <div className="flex h-full flex-1 flex-col p-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">WorkTrack</h1>
          <p className="text-sm text-slate-500">{status.hostname}</p>
        </div>
        <button
          onClick={onLogout}
          className="text-sm text-slate-400 hover:text-slate-600"
          type="button"
        >
          Sign out
        </button>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <Tile label="Workday" value={status.workdayActive ? 'Active' : 'Stopped'} />
        <Tile label="Private session" value={status.inPrivateSession ? 'On' : 'Off'} />
        <Tile label="Server" value={status.online ? 'Online' : 'Offline (buffering)'} />
        <Tile label="Buffered events" value={status.bufferedEventCount.toString()} />
      </section>

      <div className="mt-auto flex flex-col gap-2 pt-6">
        {!status.workdayActive ? (
          <button
            type="button"
            onClick={() => void agent.startWorkday()}
            className="rounded-md bg-brand-500 px-4 py-2 font-medium text-white shadow-sm hover:bg-brand-700"
          >
            Start workday
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void agent.endWorkday()}
            className="rounded-md bg-slate-200 px-4 py-2 font-medium text-slate-800 hover:bg-slate-300"
          >
            End workday
          </button>
        )}
        <button
          type="button"
          onClick={() => void agent.togglePrivate()}
          className="rounded-md border border-slate-200 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
        >
          {status.inPrivateSession ? 'End private session' : 'Start private session'}
        </button>
      </div>

      <footer className="mt-4 text-center text-xs text-slate-400">
        WorkTrack v{status.agentVersion} · Monitoring is paused outside scheduled hours.
      </footer>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-800">{value}</div>
    </div>
  );
}
