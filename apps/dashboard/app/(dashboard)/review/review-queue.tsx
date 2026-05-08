'use client';

import { useState } from 'react';

interface Item {
  id: string;
  takenAt: string;
  trigger: string;
  aiSummary: string | null;
  aiCategory: string | null;
  downloadUrl: string | null;
  user: { id: string; fullName: string };
}

export function ReviewQueue({ initial }: { initial: Item[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(id: string, decision: 'approve' | 'flag' | 'dismiss'): Promise<void> {
    setBusy(id);
    try {
      const res = await fetch(`/api/proxy/screenshots/${id}/review`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      if (res.ok) setItems((s) => s.filter((i) => i.id !== id));
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return <div className="card text-sm text-slate-500">No screenshots pending review.</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {items.map((item) => (
        <article key={item.id} className="card space-y-3">
          <header className="flex items-baseline justify-between">
            <div className="font-medium">{item.user.fullName}</div>
            <time className="text-xs text-slate-500">
              {new Date(item.takenAt).toLocaleString()}
            </time>
          </header>
          {item.downloadUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.downloadUrl}
              alt="captured screenshot"
              className="max-h-64 w-full rounded border border-slate-200 object-contain"
            />
          ) : (
            <div className="text-sm text-slate-500">Image temporarily unavailable.</div>
          )}
          <div className="text-xs text-slate-500">
            <div>Trigger: {item.trigger}</div>
            {item.aiCategory && <div>AI: {item.aiCategory}</div>}
            {item.aiSummary && <p className="mt-1 italic">{item.aiSummary}</p>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void decide(item.id, 'dismiss')}
              disabled={busy === item.id}
              type="button"
              className="btn-secondary flex-1"
            >
              Dismiss
            </button>
            <button
              onClick={() => void decide(item.id, 'flag')}
              disabled={busy === item.id}
              type="button"
              className="btn-primary flex-1"
            >
              Flag
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
