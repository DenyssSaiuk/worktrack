/**
 * Native messaging bridge to the WorkTrack desktop agent. The agent registers
 * a native host manifest that points to a small bridge binary
 * (`worktrack-agent-bridge`) which forwards messages from the browser into
 * the running agent's local IPC. The browser hands us a port over which we
 * send length-prefixed JSON (handled by chrome.runtime.connectNative).
 */
import type { ExtensionEvent } from './types.js';

let port: chrome.runtime.Port | null = null;
let connecting = false;

export type Status = 'connected' | 'disconnected' | 'unsupported';

const listeners = new Set<(status: Status) => void>();

export function onStatusChange(handler: (s: Status) => void): () => void {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

function emit(status: Status): void {
  for (const l of listeners) l(status);
}

function api(): typeof chrome {
  return chrome;
}

export function ensureConnected(hostName: string): void {
  if (port || connecting) return;
  if (!api().runtime?.connectNative) {
    emit('unsupported');
    return;
  }
  connecting = true;
  try {
    port = api().runtime.connectNative(hostName);
    port.onDisconnect.addListener(() => {
      port = null;
      connecting = false;
      emit('disconnected');
    });
    port.onMessage.addListener(() => {
      // The agent acks events; we don't need to act on them.
    });
    connecting = false;
    emit('connected');
  } catch {
    port = null;
    connecting = false;
    emit('disconnected');
  }
}

export function sendEvent(hostName: string, evt: ExtensionEvent): boolean {
  ensureConnected(hostName);
  if (!port) return false;
  try {
    port.postMessage({ kind: 'event', event: evt });
    return true;
  } catch {
    port = null;
    return false;
  }
}
