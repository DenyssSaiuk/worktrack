import { SettingsForm } from './settings-form';
import { api } from '../../../lib/api';
import { requireUser } from '../../../lib/session';

export default async function SettingsPage() {
  const user = await requireUser();
  const settings = await api.getOrgSettings(user.accessToken).catch(() => null);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Organization settings</h1>
        <p className="text-sm text-slate-500">
          Retention, screenshot policy, and AI analysis settings. Changes are audit-logged.
        </p>
      </header>
      {settings ? (
        <SettingsForm initial={settings} canEdit={user.role === 'admin'} />
      ) : (
        <div>Failed to load.</div>
      )}
    </div>
  );
}
