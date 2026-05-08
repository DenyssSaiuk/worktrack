/**
 * Backend API client. Server-side: imports cookies() and forwards the
 * httpOnly access token. Client-side: relies on the Next.js route handlers
 * under `/api/proxy` to attach the cookie. Direct browser fetches to the
 * backend are forbidden by CORS — everything goes through Next.js as the
 * single trusted origin.
 */

export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

export class ApiException extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(err: ApiError) {
    super(err.message);
    this.status = err.status;
    this.code = err.code;
    this.details = err.details;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
}

const SERVER_BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${SERVER_BACKEND_URL}${path}`;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;

  const init: RequestInit = {
    method: opts.method ?? 'GET',
    headers,
    cache: 'no-store',
  };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
  const res = await fetch(url, init);

  if (!res.ok) {
    let payload: { error?: { code?: string; message?: string; details?: unknown } } = {};
    try {
      payload = (await res.json()) as typeof payload;
    } catch {
      /* keep default */
    }
    throw new ApiException({
      status: res.status,
      code: payload.error?.code ?? `HTTP_${res.status}`,
      message: payload.error?.message ?? res.statusText,
      details: payload.error?.details,
    });
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{
      user: { id: string; email: string; fullName: string; role: string; organizationId: string };
      tokens: { accessToken: string; refreshToken: string; expiresIn: number };
    }>('/api/v1/auth/login', { method: 'POST', body: { email, password } }),

  refresh: (refreshToken: string) =>
    request<{
      tokens: { accessToken: string; refreshToken: string; expiresIn: number };
    }>('/api/v1/auth/refresh', { method: 'POST', body: { refreshToken } }),

  logout: (refreshToken: string, accessToken: string) =>
    request<void>('/api/v1/auth/logout', {
      method: 'POST',
      body: { refreshToken },
      token: accessToken,
    }),

  me: (token: string) =>
    request<{
      id: string;
      email: string;
      fullName: string;
      role: string;
      organizationId: string;
    }>('/api/v1/auth/me', { token }),

  listUsers: (token: string, page = 1) =>
    request<{
      items: Array<{
        id: string;
        email: string;
        fullName: string;
        role: string;
        managerId: string | null;
        status: string;
      }>;
      total: number;
      page: number;
      pageSize: number;
    }>(`/api/v1/users?page=${page}&pageSize=200`, { token }),

  createEnrollToken: (token: string, userId: string) =>
    request<{ enrollToken: string; expiresAt: string }>(
      `/api/v1/admin/users/${userId}/enroll-token`,
      { method: 'POST', token, body: {} },
    ),

  listSessions: (token: string, params: { userId?: string; from: string; to: string }) => {
    const sp = new URLSearchParams();
    if (params.userId) sp.set('userId', params.userId);
    sp.set('from', params.from);
    sp.set('to', params.to);
    return request<unknown[]>(`/api/v1/activity/sessions?${sp.toString()}`, { token });
  },

  timeline: (token: string, userId: string, date: string) =>
    request<{ events: Array<Record<string, unknown>> }>(
      `/api/v1/activity/timeline?userId=${userId}&date=${date}`,
      { token },
    ),

  summary: (token: string, userId: string, from: string, to: string) =>
    request<
      Array<{
        date: string;
        workedMinutes: number;
        idleMinutes: number;
        productiveMinutes: number;
        neutralMinutes: number;
        distractingMinutes: number;
        productivityScore: number;
      }>
    >(`/api/v1/activity/summary?userId=${userId}&from=${from}&to=${to}`, { token }),

  categories: (token: string, userId: string, date: string) =>
    request<{
      productiveMinutes: number;
      neutralMinutes: number;
      distractingMinutes: number;
      topApps: Array<{ label: string; minutes: number }>;
      topSites: Array<{ label: string; minutes: number }>;
    }>(`/api/v1/activity/categories?userId=${userId}&date=${date}`, { token }),

  listRules: (token: string) =>
    request<Array<{ id: string; pattern: string; category: string; appliesTo: unknown }>>(
      '/api/v1/rules',
      { token },
    ),

  createRule: (
    token: string,
    body: { pattern: string; category: string; appliesTo: 'all' | string[] },
  ) => request('/api/v1/rules', { method: 'POST', token, body }),

  deleteRule: (token: string, id: string) =>
    request(`/api/v1/rules/${id}`, { method: 'DELETE', token }),

  getOrgSettings: (token: string) =>
    request<{
      id: string;
      name: string;
      retentionDays: number;
      settings: Record<string, unknown>;
    }>('/api/v1/organizations/me', { token }),

  updateOrgSettings: (token: string, body: Record<string, unknown>) =>
    request('/api/v1/organizations/me', { method: 'PATCH', token, body }),
};
