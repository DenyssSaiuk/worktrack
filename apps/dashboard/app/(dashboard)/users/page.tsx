import { UsersTable } from './users-table';
import { api } from '../../../lib/api';
import { requireUser } from '../../../lib/session';

export default async function UsersPage() {
  const user = await requireUser();
  if (user.role !== 'admin') {
    return <div>Admin only.</div>;
  }
  const list = await api.listUsers(user.accessToken).catch(() => ({
    items: [] as Array<{
      id: string;
      fullName: string;
      email: string;
      role: string;
      status: string;
    }>,
  }));
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="text-sm text-slate-500">Manage agent enrollment, roles, and consent.</p>
      </header>
      <UsersTable initial={list.items} />
    </div>
  );
}
