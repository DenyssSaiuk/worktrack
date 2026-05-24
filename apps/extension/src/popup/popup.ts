/**
 * Popup UI. Three modes:
 *  1. Signed out → login form (email, password, server URL)
 *  2. Signed in, no active workday → "Start Workday" button
 *  3. Signed in, active workday → "Stop Workday" button + live status
 */
import { endWorkday, login, logout, startWorkday } from '../lib/api.js';
import { getSettings, setSettings } from '../lib/storage.js';

interface PopupStatus {
  queued: number;
  settings: { backendUrl: string; paused: boolean; domainOnly: boolean };
  auth: { email: string; fullName: string; role: string } | null;
  workday: { active: boolean } | null;
}

const POLICY_URL = 'https://worktrack.local/privacy';

async function fetchStatus(): Promise<PopupStatus> {
  return chrome.runtime.sendMessage({ kind: 'status' });
}

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el;
}

async function render(): Promise<void> {
  const status = await fetchStatus();
  const signedOut = $('signed-out');
  const signedIn = $('signed-in');
  const roleTag = $('role-tag');

  if (!status.auth) {
    signedOut.classList.remove('hidden');
    signedIn.classList.add('hidden');
    roleTag.classList.add('hidden');
    (document.getElementById('login-server') as HTMLInputElement).value =
      status.settings.backendUrl;
    return;
  }

  signedOut.classList.add('hidden');
  signedIn.classList.remove('hidden');
  roleTag.classList.remove('hidden');
  roleTag.textContent = status.auth.role;

  $('who').textContent = `${status.auth.fullName} (${status.auth.email})`;

  const dot = $('dot');
  const label = $('workday-label');
  const toggle = $('workday-toggle') as HTMLButtonElement;
  const active = status.workday?.active ?? false;
  dot.classList.toggle('active', active && !status.settings.paused);
  if (status.settings.paused) {
    label.textContent = 'Tracking paused';
    toggle.textContent = active ? 'Stop Workday' : 'Start Workday';
  } else if (active) {
    label.textContent = 'Workday active — tracking tabs';
    toggle.textContent = 'Stop Workday';
  } else {
    label.textContent = 'Workday not started';
    toggle.textContent = 'Start Workday';
  }
  const queueLine = $('queue-line');
  if (status.queued > 0) {
    queueLine.classList.remove('hidden');
    queueLine.textContent = `${status.queued} events buffered (will flush automatically).`;
  } else {
    queueLine.classList.add('hidden');
  }
  ($('pause-toggle') as HTMLButtonElement).textContent = status.settings.paused
    ? 'Resume tracking'
    : 'Pause tracking';
  ($('policy-link') as HTMLAnchorElement).href = POLICY_URL;
}

function showError(msg: string): void {
  const el = $('login-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  const form = $('login-form') as HTMLFormElement;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    $('login-error').classList.add('hidden');
    const email = (document.getElementById('login-email') as HTMLInputElement).value;
    const password = (document.getElementById('login-password') as HTMLInputElement).value;
    const server = (document.getElementById('login-server') as HTMLInputElement).value;
    const btn = $('login-submit') as HTMLButtonElement;
    btn.disabled = true;
    try {
      await setSettings({ backendUrl: server });
      await login(server, email, password);
      await render();
    } catch (err) {
      showError((err as Error).message);
    } finally {
      btn.disabled = false;
    }
  });

  $('workday-toggle').addEventListener('click', async () => {
    const settings = await getSettings();
    const status = await fetchStatus();
    try {
      if (status.workday?.active) await endWorkday(settings.backendUrl);
      else await startWorkday(settings.backendUrl);
      await render();
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert((err as Error).message);
    }
  });

  $('pause-toggle').addEventListener('click', async () => {
    const current = await getSettings();
    await setSettings({ paused: !current.paused });
    await render();
  });

  $('logout').addEventListener('click', async () => {
    const settings = await getSettings();
    await logout(settings.backendUrl);
    await render();
  });

  void render();
});
