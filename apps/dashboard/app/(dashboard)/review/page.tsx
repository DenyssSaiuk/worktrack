import { ReviewQueue } from './review-queue';
import { requireUser } from '../../../lib/session';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';

export default async function ReviewPage() {
  const user = await requireUser();
  if (user.role === 'employee') return <div>Not authorized.</div>;

  const res = await fetch(`${BACKEND_URL}/api/v1/screenshots`, {
    headers: { authorization: `Bearer ${user.accessToken}` },
    cache: 'no-store',
  });
  const items = res.ok
    ? ((await res.json()) as Array<{
        id: string;
        takenAt: string;
        trigger: string;
        aiSummary: string | null;
        aiCategory: string | null;
        downloadUrl: string | null;
        user: { id: string; fullName: string };
      }>)
    : [];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Screenshot review</h1>
        <p className="text-sm text-slate-500">
          Trigger-based captures. Review and dismiss to clear them from the queue.
        </p>
      </header>
      <ReviewQueue initial={items} />
    </div>
  );
}
