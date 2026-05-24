import { DEFAULT_SETTINGS } from './types.js';

import type { ExtensionAuth, ExtensionEvent, ExtensionSettings } from './types.js';

const SETTINGS_KEY = 'worktrack:settings';
const AUTH_KEY = 'worktrack:auth';
const QUEUE_KEY = 'worktrack:queue';
const QUEUE_LIMIT = 5_000;

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] ?? {}) };
}

export async function setSettings(patch: Partial<ExtensionSettings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({ [SETTINGS_KEY]: { ...current, ...patch } });
}

export async function getAuth(): Promise<ExtensionAuth | null> {
  const stored = await chrome.storage.local.get(AUTH_KEY);
  return (stored[AUTH_KEY] as ExtensionAuth | undefined) ?? null;
}

export async function setAuth(auth: ExtensionAuth | null): Promise<void> {
  if (!auth) {
    await chrome.storage.local.remove(AUTH_KEY);
  } else {
    await chrome.storage.local.set({ [AUTH_KEY]: auth });
  }
}

export async function enqueue(events: ExtensionEvent[]): Promise<void> {
  if (events.length === 0) return;
  const stored = await chrome.storage.local.get(QUEUE_KEY);
  const queue: ExtensionEvent[] = stored[QUEUE_KEY] ?? [];
  queue.push(...events);
  if (queue.length > QUEUE_LIMIT) queue.splice(0, queue.length - QUEUE_LIMIT);
  await chrome.storage.local.set({ [QUEUE_KEY]: queue });
}

export async function drainQueue(): Promise<ExtensionEvent[]> {
  const stored = await chrome.storage.local.get(QUEUE_KEY);
  const queue: ExtensionEvent[] = stored[QUEUE_KEY] ?? [];
  await chrome.storage.local.set({ [QUEUE_KEY]: [] });
  return queue;
}

export async function queueLength(): Promise<number> {
  const stored = await chrome.storage.local.get(QUEUE_KEY);
  return (stored[QUEUE_KEY] ?? []).length as number;
}
