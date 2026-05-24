/**
 * Direct backend client. The extension no longer talks to a desktop agent
 * over native messaging — it owns its own JWT and POSTs events straight to
 * the WorkTrack backend on behalf of the signed-in user.
 *
 * Token lifecycle:
 *   - login()    → store access + refresh + expiry
 *   - withAuth() → if access expires in <60s, refresh first
 *   - refresh()  → rotates both tokens (backend enforces single-use)
 */
import { getAuth, setAuth } from './storage.js';

import type { ExtensionAuth, ExtensionEvent } from './types.js';

interface LoginResp {
  user: { id: string; email: string; fullName: string; role: string; organizationId: string };
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
}

interface RefreshResp {
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
}

export interface WorkdayStatus {
  active: boolean;
  sessionId?: string;
  startedAt?: string;
}

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function http<T>(
  baseUrl: string,
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...rest } = init;
  const headers = new Headers(rest.headers ?? {});
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (rest.body !== undefined) headers.set('content-type', 'application/json');
  const res = await fetch(`${baseUrl}${path}`, { ...rest, headers });
  if (!res.ok) {
    const txt = await res.text();
    throw new HttpError(res.status, txt || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function login(
  baseUrl: string,
  email: string,
  password: string,
): Promise<ExtensionAuth> {
  const r = await http<LoginResp>(baseUrl, '/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const auth: ExtensionAuth = {
    accessToken: r.tokens.accessToken,
    refreshToken: r.tokens.refreshToken,
    accessExpiresAt: Date.now() + r.tokens.expiresIn * 1000,
    email: r.user.email,
    fullName: r.user.fullName,
    role: r.user.role,
  };
  await setAuth(auth);
  return auth;
}

export async function logout(baseUrl: string): Promise<void> {
  const auth = await getAuth();
  if (auth) {
    await http(baseUrl, '/api/v1/auth/logout', {
      method: 'POST',
      token: auth.accessToken,
      body: JSON.stringify({ refreshToken: auth.refreshToken }),
    }).catch(() => {});
  }
  await setAuth(null);
}

async function refresh(baseUrl: string, auth: ExtensionAuth): Promise<ExtensionAuth> {
  const r = await http<RefreshResp>(baseUrl, '/api/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: auth.refreshToken }),
  });
  const next: ExtensionAuth = {
    ...auth,
    accessToken: r.tokens.accessToken,
    refreshToken: r.tokens.refreshToken,
    accessExpiresAt: Date.now() + r.tokens.expiresIn * 1000,
  };
  await setAuth(next);
  return next;
}

/** Get a usable access token, refreshing if it's about to expire. Returns null when logged out. */
export async function getValidToken(baseUrl: string): Promise<string | null> {
  let auth = await getAuth();
  if (!auth) return null;
  if (auth.accessExpiresAt - Date.now() < 60_000) {
    try {
      auth = await refresh(baseUrl, auth);
    } catch (err) {
      // refresh failed → force re-login
      if (err instanceof HttpError && err.status === 401) await setAuth(null);
      throw err;
    }
  }
  return auth.accessToken;
}

export async function getWorkdayStatus(baseUrl: string): Promise<WorkdayStatus | null> {
  const token = await getValidToken(baseUrl);
  if (!token) return null;
  return http<WorkdayStatus>(baseUrl, '/api/v1/me/workday', { token });
}

export async function startWorkday(baseUrl: string): Promise<WorkdayStatus> {
  const token = await getValidToken(baseUrl);
  if (!token) throw new Error('Not signed in');
  return http<WorkdayStatus>(baseUrl, '/api/v1/me/workday/start', { method: 'POST', token });
}

export async function endWorkday(baseUrl: string): Promise<{ ended: boolean }> {
  const token = await getValidToken(baseUrl);
  if (!token) throw new Error('Not signed in');
  return http<{ ended: boolean }>(baseUrl, '/api/v1/me/workday/end', { method: 'POST', token });
}

export async function heartbeat(baseUrl: string): Promise<void> {
  const token = await getValidToken(baseUrl);
  if (!token) return;
  await http(baseUrl, '/api/v1/me/heartbeat', { method: 'POST', token });
}

export async function pushEvents(
  baseUrl: string,
  events: ExtensionEvent[],
): Promise<{ accepted: number; duplicates: number }> {
  if (events.length === 0) return { accepted: 0, duplicates: 0 };
  const token = await getValidToken(baseUrl);
  if (!token) throw new Error('Not signed in');
  return http(baseUrl, '/api/v1/me/events', {
    method: 'POST',
    token,
    body: JSON.stringify({ events }),
  });
}
