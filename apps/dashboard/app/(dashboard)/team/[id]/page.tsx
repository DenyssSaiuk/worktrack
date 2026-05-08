import { CategoryPie } from '../../../../components/CategoryPie';
import { api } from '../../../../lib/api';
import { requireUser } from '../../../../lib/session';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function UserDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const today = todayIso();
  const [categories, summary] = await Promise.all([
    api.categories(user.accessToken, params.id, today).catch(() => null),
    api
      .summary(
        user.accessToken,
        params.id,
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        new Date().toISOString(),
      )
      .catch(() => [] as Array<{ date: string; productivityScore: number }>),
  ]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">User detail</h1>
        <p className="text-sm text-slate-500">User {params.id}</p>
      </header>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-1">
          <h2 className="mb-2 text-sm font-medium">Today</h2>
          {categories ? (
            <CategoryPie
              productiveMinutes={categories.productiveMinutes}
              neutralMinutes={categories.neutralMinutes}
              distractingMinutes={categories.distractingMinutes}
            />
          ) : (
            <div className="text-sm text-slate-500">No data yet.</div>
          )}
        </div>
        <div className="card lg:col-span-2">
          <h2 className="mb-2 text-sm font-medium">Last 7 days</h2>
          {summary.length === 0 ? (
            <div className="text-sm text-slate-500">
              No daily summaries yet — the daily aggregation worker runs at 00:05 UTC.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-1">Date</th>
                  <th className="py-1">Score</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((row) => (
                  <tr key={row.date}>
                    <td className="py-1">{new Date(row.date).toISOString().slice(0, 10)}</td>
                    <td className="py-1">{row.productivityScore.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
