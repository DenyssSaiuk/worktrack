/* Live dashboard — currently working employees + activity. WebSocket
 * subscription is added incrementally on the client. */
import { LivePanel } from './live-panel';
import { api } from '../../lib/api';
import { requireUser } from '../../lib/session';

export default async function LivePage() {
  const user = await requireUser();
  const users = await api.listUsers(user.accessToken).catch(() => ({
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
        <h1 className="text-xl font-semibold">Live</h1>
        <p className="text-sm text-slate-500">
          People currently signed in to the agent. Updates stream over WebSocket.
        </p>
      </header>
      <LivePanel users={users.items} />
    </div>
  );
}
