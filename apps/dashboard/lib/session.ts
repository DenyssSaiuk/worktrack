/**
 * Server-side session helpers. The dashboard stores the access + refresh
 * tokens in httpOnly cookies set by the /api/auth/login route handler.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { api, ApiException } from './api';

const ACCESS = 'wt_access';
const REFRESH = 'wt_refresh';
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

export async function setSessionCookies(
  access: string,
  refresh: string,
  expiresIn: number,
): Promise<void> {
  const jar = cookies();
  jar.set(ACCESS, access, { ...COOKIE_OPTS, maxAge: expiresIn });
  jar.set(REFRESH, refresh, { ...COOKIE_OPTS, maxAge: 7 * 24 * 60 * 60 });
}

export function clearSessionCookies(): void {
  const jar = cookies();
  jar.delete(ACCESS);
  jar.delete(REFRESH);
}

export function getAccessToken(): string | null {
  return cookies().get(ACCESS)?.value ?? null;
}

export function getRefreshToken(): string | null {
  return cookies().get(REFRESH)?.value ?? null;
}

export async function requireUser(): Promise<{
  id: string;
  email: string;
  fullName: string;
  role: string;
  organizationId: string;
  accessToken: string;
}> {
  let access = getAccessToken();
  if (!access) {
    const refresh = getRefreshToken();
    if (!refresh) redirect('/login');
    try {
      const res = await api.refresh(refresh!);
      await setSessionCookies(
        res.tokens.accessToken,
        res.tokens.refreshToken,
        res.tokens.expiresIn,
      );
      access = res.tokens.accessToken;
    } catch {
      clearSessionCookies();
      redirect('/login');
    }
  }
  try {
    const me = await api.me(access!);
    return { ...me, accessToken: access! };
  } catch (err) {
    if (err instanceof ApiException && err.status === 401) {
      clearSessionCookies();
      redirect('/login');
    }
    throw err;
  }
}
