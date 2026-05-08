import { getSettings, setSettings } from '../lib/storage.js';

const POLICY_URL = 'https://worktrack.local/privacy';

interface StatusResponse {
  queued: number;
  settings: { paused: boolean };
}

async function refresh(): Promise<void> {
  const status: StatusResponse = await chrome.runtime.sendMessage({ kind: 'status' });
  const statusEl = document.getElementById('status')!;
  const button = document.getElementById('pause-toggle') as HTMLButtonElement;
  if (status.settings.paused) {
    statusEl.textContent = 'Paused — no activity reported.';
    button.textContent = 'Resume';
  } else {
    statusEl.textContent =
      status.queued > 0
        ? `Tracking active · ${status.queued} events buffered (agent offline)`
        : 'Tracking active · agent online';
    button.textContent = 'Pause for this session';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const policyLink = document.getElementById('policy-link') as HTMLAnchorElement;
  policyLink.href = POLICY_URL;

  const button = document.getElementById('pause-toggle') as HTMLButtonElement;
  button.addEventListener('click', async () => {
    const current = await getSettings();
    await setSettings({ paused: !current.paused });
    await refresh();
  });

  void refresh();
});
