'use client';

import { useState } from 'react';

interface User {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
}

export function UsersTable({ initial }: { initial: User[] }) {
  const [tokens, setTokens] = useState<Record<string, { token: string; expiresAt: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function generateToken(userId: string): Promise<void> {
    setBusy(userId);
    try {
      const res = await fetch(`/api/proxy/admin/users/${userId}/enroll-token`, { method: 'POST' });
      if (!res.ok) throw new Error('failed');
      const body = (await res.json()) as { enrollToken: string; expiresAt: string };
      setTokens((s) => ({
        ...s,
        [userId]: { token: body.enrollToken, expiresAt: body.expiresAt },
      }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Email</th>
            <th className="px-4 py-2">Role</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2 text-right">Enrollment</th>
          </tr>
        </thead>
        <tbody>
          {initial.map((u) => (
            <tr key={u.id} className="border-t border-slate-100 align-top">
              <td className="px-4 py-2 font-medium">{u.fullName}</td>
              <td className="px-4 py-2 text-slate-600">{u.email}</td>
              <td className="px-4 py-2 text-slate-600">{u.role}</td>
              <td className="px-4 py-2">
                <span className="pill bg-slate-100 text-slate-600">{u.status}</span>
              </td>
              <td className="px-4 py-2 text-right">
                {tokens[u.id] ? (
                  <div className="space-y-1 text-xs">
                    <code className="block break-all rounded bg-slate-100 p-2 font-mono">
                      {tokens[u.id]!.token}
                    </code>
                    <div className="text-slate-500">
                      expires {new Date(tokens[u.id]!.expiresAt).toLocaleString()}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => void generateToken(u.id)}
                    disabled={busy === u.id || u.role === 'admin'}
                  >
                    {busy === u.id ? 'Generating…' : 'Generate enroll token'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
