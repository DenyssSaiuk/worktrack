import { ReportsForm } from './reports-form';
import { requireUser } from '../../../lib/session';

export default async function ReportsPage() {
  await requireUser();
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Reports</h1>
        <p className="text-sm text-slate-500">
          Generate Excel exports for a user or the whole org.
        </p>
      </header>
      <ReportsForm />
    </div>
  );
}
