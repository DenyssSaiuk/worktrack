'use client';

import { useEffect, useState } from 'react';

interface User {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
}

interface LiveTick {
  kind: 'heartbeat';
  userId: string;
  online: boolean;
  inPrivateSession: boolean;
}

export function LivePanel({ users }: { users: User[] }) {
  const [live, setLive] = useState<Record<string, LiveTick>>({});
  const [wsState, setWsState] = useState<'connecting' | 'open' | 'closed'>('connecting');

  useEffect(() => {
    const wsUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(
      /^http/,
      'ws',
    );
    let cancelled = false;
    let socket: WebSocket | null = null;

    async function connect(): Promise<void> {
      try {
        const tokenRes = await fetch('/api/auth/ws-token');
        if (!tokenRes.ok) throw new Error('ws token failed');
        const { token } = (await tokenRes.json()) as { token: string };
        if (cancelled) return;
        socket = new WebSocket(`${wsUrl}/api/v1/ws?token=${encodeURIComponent(token)}`);
        socket.addEventListener('open', () => setWsState('open'));
        socket.addEventListener('close', () => setWsState('closed'));
        socket.addEventListener('message', (ev) => {
          try {
            const msg = JSON.parse(String(ev.data)) as LiveTick;
            if (msg.kind === 'heartbeat') {
              setLive((s) => ({ ...s, [msg.userId]: msg }));
            }
          } catch {
            /* ignore */
          }
        });
      } catch {
        setWsState('closed');
      }
    }
    void connect();
    return () => {
      cancelled = true;
      socket?.close();
    };
  }, []);

  return (
    <section className="space-y-3">
      <div className="text-xs text-slate-500">
        WebSocket: <span className="font-mono">{wsState}</span>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
        {users.length === 0 && <div className="text-sm text-slate-500">No users yet.</div>}
        {users.map((u) => {
          const tick = live[u.id];
          const online = tick?.online ?? false;
          return (
            <div key={u.id} className="card flex items-center justify-between">
              <div>
                <div className="font-medium">{u.fullName}</div>
                <div className="text-xs text-slate-500">{u.email}</div>
              </div>
              <span
                className={`pill ${online ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}
              >
                {online ? 'online' : 'offline'}
                {tick?.inPrivateSession && ' · private'}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
