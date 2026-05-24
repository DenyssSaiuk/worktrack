import { WorkdayPanel } from './workday-panel';
import { requireUser } from '../../../lib/session';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:7340';

interface WorkdayStatus {
  active: boolean;
  sessionId?: string;
  startedAt?: string;
  deviceId?: string;
}

export default async function WorkdayPage() {
  const user = await requireUser();

  let initial: WorkdayStatus = { active: false };
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/me/workday`, {
      headers: { authorization: `Bearer ${user.accessToken}` },
      cache: 'no-store',
    });
    if (res.ok) initial = (await res.json()) as WorkdayStatus;
  } catch {
    /* fall through with default */
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">My Workday</h1>
        <p className="text-sm text-slate-500">
          Hi, {user.fullName.split(' ')[0] ?? user.email}. Start your workday to begin time
          tracking. Tracking stops the moment you click <strong>Stop Workday</strong>.
        </p>
      </header>
      <WorkdayPanel initial={initial} userFullName={user.fullName} />
    </div>
  );
}
