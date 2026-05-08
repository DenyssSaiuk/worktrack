'use client';

import { useState } from 'react';

interface Rule {
  id: string;
  pattern: string;
  category: string;
  appliesTo: unknown;
}

const CATEGORIES = ['productive', 'neutral', 'distracting', 'blocked'] as const;

export function RulesTable({ initial, canEdit }: { initial: Rule[]; canEdit: boolean }) {
  const [rules, setRules] = useState(initial);
  const [pattern, setPattern] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('productive');
  const [busy, setBusy] = useState(false);

  async function add(): Promise<void> {
    if (!pattern.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/proxy/rules', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pattern: pattern.trim(), category, appliesTo: 'all' }),
      });
      if (res.ok) {
        const created = (await res.json()) as Rule;
        setRules((r) => [...r, created]);
        setPattern('');
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string): Promise<void> {
    setBusy(true);
    try {
      const res = await fetch(`/api/proxy/rules/${id}`, { method: 'DELETE' });
      if (res.ok) setRules((r) => r.filter((x) => x.id !== id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="card flex flex-wrap items-end gap-3">
          <label className="flex-1">
            <span className="text-xs uppercase tracking-wide text-slate-500">Pattern</span>
            <input
              className="input mt-1"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="github.com or chrome.exe"
            />
          </label>
          <label>
            <span className="text-xs uppercase tracking-wide text-slate-500">Category</span>
            <select
              className="input mt-1"
              value={category}
              onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => void add()} disabled={busy} className="btn-primary" type="button">
            Add
          </button>
        </div>
      )}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Pattern</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Applies to</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-mono text-xs">{r.pattern}</td>
                <td className="px-4 py-2">{r.category}</td>
                <td className="px-4 py-2 text-slate-500">
                  {Array.isArray(r.appliesTo) ? `${r.appliesTo.length} users` : 'all'}
                </td>
                <td className="px-4 py-2 text-right">
                  {canEdit && (
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => void remove(r.id)}
                    >
                      delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
