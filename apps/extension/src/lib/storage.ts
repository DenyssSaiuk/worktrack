import { DEFAULT_SETTINGS } from './types.js';

import type { ExtensionEvent, ExtensionSettings } from './types.js';

const SETTINGS_KEY = 'worktrack:settings';
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
