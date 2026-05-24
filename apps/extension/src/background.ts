/**
 * MV3 service worker.
 *
 * Web-only architecture (no desktop agent):
 *   - The extension owns its own auth (JWT in chrome.storage.local).
 *   - When the signed-in user has an active workday, focused tabs are
 *     converted into `tab_focus` events and POSTed straight to
 *     /api/v1/me/events on the backend.
 *   - Events queue locally when the network is down, when the user is
 *     paused, or when the workday is closed. The flush alarm drains the
 *     queue every 30s and also sends a heartbeat.
 */
import { getWorkdayStatus, heartbeat, pushEvents } from './lib/api.js';
import { drainQueue, enqueue, getAuth, getSettings, queueLength } from './lib/storage.js';

import type { ExtensionEvent } from './lib/types.js';

const FLUSH_ALARM = 'worktrack:flush';

let lastDomain: string | null = null;

function uuid(): string {
  return crypto.randomUUID();
}

function sanitizeUrl(url: string, domainOnly: boolean): { domain: string; safeUrl?: string } {
  try {
    const u = new URL(url);
    const domain = u.hostname.toLowerCase();
    if (domainOnly) return { domain };
    return { domain, safeUrl: `${u.protocol}//${u.host}${u.pathname}` };
  } catch {
    return { domain: 'unknown' };
  }
}

async function recordTab(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:')) return;

  const settings = await getSettings();
  if (settings.paused) return;
  const auth = await getAuth();
  if (!auth) return; // not signed in yet

  const { domain, safeUrl } = sanitizeUrl(tab.url, settings.domainOnly);
  if (domain === lastDomain) return;
  lastDomain = domain;

  const payload: ExtensionEvent['payload'] = {
    browser: navigator.userAgent.includes('Firefox') ? 'firefox' : 'chrome',
    domain,
    title: (tab.title ?? '').slice(0, 480),
    incognito: tab.incognito ?? false,
  };
  if (safeUrl) payload.url = safeUrl;

  const evt: ExtensionEvent = {
    clientEventId: uuid(),
    timestamp: new Date().toISOString(),
    type: 'tab_focus',
    payload,
  };

  // Best-effort direct push; on any failure (offline, workday closed,
  // unauthorized), buffer locally and let the flush loop retry.
  try {
    const status = await getWorkdayStatus(settings.backendUrl);
    if (!status?.active) {
      await enqueue([evt]);
      return;
    }
    await pushEvents(settings.backendUrl, [evt]);
  } catch {
    await enqueue([evt]);
  }
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    await recordTab(tab);
  } catch {
    /* tab may have closed */
  }
});

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.active) return;
  await recordTab(tab);
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab) await recordTab(tab);
  } catch {
    /* no active tab */
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: 0.5 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== FLUSH_ALARM) return;
  const settings = await getSettings();
  const auth = await getAuth();
  if (!auth) return;

  // Best-effort heartbeat — keeps the worker visible as "online" in the
  // Live dashboard.
  try {
    await heartbeat(settings.backendUrl);
  } catch {
    /* ignore */
  }

  if ((await queueLength()) === 0) return;
  const status = await getWorkdayStatus(settings.backendUrl).catch(() => null);
  if (!status?.active) return; // wait until the user starts a workday

  const queue = await drainQueue();
  try {
    await pushEvents(settings.backendUrl, queue);
    // eslint-disable-next-line no-console
    console.info(`[worktrack] flushed ${queue.length} buffered events`);
  } catch {
    // Push failed — put them back at the front of the queue.
    await enqueue(queue);
  }
});

// Popup polls for status via runtime.sendMessage.
chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg?.kind === 'status') {
    void (async () => {
      const settings = await getSettings();
      const auth = await getAuth();
      let workday = null;
      if (auth) {
        workday = await getWorkdayStatus(settings.backendUrl).catch(() => null);
      }
      respond({
        queued: await queueLength(),
        settings,
        auth: auth ? { email: auth.email, fullName: auth.fullName, role: auth.role } : null,
        workday,
      });
    })();
    return true;
  }
  return undefined;
});
