import Link from 'next/link';

import { api } from '../../../lib/api';
import { requireUser } from '../../../lib/session';

export default async function TeamPage() {
  const user = await requireUser();
  const users = await api.listUsers(user.accessToken).catch(() => ({
    items: [] as Array<{
      id: string;
      fullName: string;
      email: string;
      role: string;
      managerId: string | null;
      status: string;
    }>,
  }));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Team</h1>
        <p className="text-sm text-slate-500">
          {user.role === 'manager' ? 'Direct reports.' : 'Everyone in your organization.'}
        </p>
      </header>
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.items.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{u.fullName}</td>
                <td className="px-4 py-2 text-slate-600">{u.email}</td>
                <td className="px-4 py-2 text-slate-600">{u.role}</td>
                <td className="px-4 py-2">
                  <span className="pill bg-slate-100 text-slate-600">{u.status}</span>
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/team/${u.id}`} className="text-brand-600 hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
