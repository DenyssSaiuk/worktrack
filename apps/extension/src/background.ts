/**
 * MV3 service worker. Listens for tab/window focus changes, builds tab_focus
 * events, and forwards them to the local agent via native messaging. If the
 * agent isn't running, events queue in chrome.storage.local until it
 * reconnects.
 */
import { ensureConnected, sendEvent } from './lib/native.js';
import { drainQueue, enqueue, getSettings, queueLength } from './lib/storage.js';

import type { ExtensionEvent } from './lib/types.js';

const FLUSH_ALARM = 'worktrack:flush';

let lastDomain: string | null = null;

function uuid(): string {
  return crypto.randomUUID();
}

function sanitizeUrl(url: string, trackUrls: boolean): { domain: string; safeUrl?: string } {
  try {
    const u = new URL(url);
    const domain = u.hostname.toLowerCase();
    if (!trackUrls) return { domain };
    // Drop the query string and fragment; keep path only.
    return { domain, safeUrl: `${u.protocol}//${u.host}${u.pathname}` };
  } catch {
    return { domain: 'unknown' };
  }
}

async function recordTab(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:')) return;

  const settings = await getSettings();
  if (settings.paused) return;

  const { domain, safeUrl } = sanitizeUrl(tab.url, settings.trackUrls);
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

  if (!sendEvent(settings.hostPort, evt)) {
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
  ensureConnected(settings.hostPort);
  if ((await queueLength()) === 0) return;
  const queue = await drainQueue();
  let delivered = 0;
  for (const evt of queue) {
    if (sendEvent(settings.hostPort, evt)) delivered++;
    else {
      // Re-queue what we couldn't ship.
      await enqueue([evt]);
    }
  }
  if (delivered > 0) {
    // eslint-disable-next-line no-console
    console.info(`[worktrack] flushed ${delivered} buffered events`);
  }
});

// Popup / options page can read live status via runtime.sendMessage.
chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg?.kind === 'status') {
    void (async () => {
      respond({
        queued: await queueLength(),
        settings: await getSettings(),
      });
    })();
    return true;
  }
  return undefined;
});
