import { RulesTable } from './rules-table';
import { api } from '../../../lib/api';
import { requireUser } from '../../../lib/session';

export default async function RulesPage() {
  const user = await requireUser();
  const rules = await api
    .listRules(user.accessToken)
    .catch(
      () => [] as Array<{ id: string; pattern: string; category: string; appliesTo: unknown }>,
    );
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Productivity rules</h1>
        <p className="text-sm text-slate-500">
          Domain or process patterns and how they classify activity.
        </p>
      </header>
      <RulesTable initial={rules} canEdit={user.role === 'admin'} />
    </div>
  );
}
