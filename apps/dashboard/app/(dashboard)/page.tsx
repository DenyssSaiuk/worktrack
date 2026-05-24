/* Live dashboard — currently working employees + activity. The page seeds
 * presence from a server snapshot (Device.lastSeenAt within 90 s) so the
 * first render is accurate; the WebSocket then streams subsequent ticks. */
import { redirect } from 'next/navigation';

import { LivePanel } from './live-panel';
import { api } from '../../lib/api';
import { requireUser } from '../../lib/session';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:7340';

export default async function LivePage() {
  const user = await requireUser();
  // Employees never need the cross-team Live page; send them to their
  // personal workday view.
  if (user.role === 'employee') redirect('/workday');
  const [users, presenceRes] = await Promise.all([
    api.listUsers(user.accessToken).catch(() => ({
      items: [] as Array<{
        id: string;
        fullName: string;
        email: string;
        role: string;
        status: string;
      }>,
    })),
    fetch(`${BACKEND_URL}/api/v1/activity/presence`, {
      headers: { authorization: `Bearer ${user.accessToken}` },
      cache: 'no-store',
    }).catch(() => null),
  ]);
  const presence =
    presenceRes && presenceRes.ok
      ? ((await presenceRes.json()) as Array<{
          userId: string;
          online: boolean;
          lastSeenAt: string | null;
        }>)
      : [];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Live</h1>
        <p className="text-sm text-slate-500">
          People currently signed in. Initial state is the server snapshot (heartbeat within the
          last 90&nbsp;s); WebSocket streams subsequent updates.
        </p>
      </header>
      <LivePanel users={users.items} initialPresence={presence} />
    </div>
  );
}
