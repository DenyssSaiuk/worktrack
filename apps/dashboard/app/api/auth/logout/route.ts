import { NextResponse } from 'next/server';

import { api } from '../../../../lib/api';
import { clearSessionCookies, getAccessToken, getRefreshToken } from '../../../../lib/session';

export async function POST(): Promise<NextResponse> {
  const access = getAccessToken();
  const refresh = getRefreshToken();
  if (access && refresh) {
    try {
      await api.logout(refresh, access);
    } catch {
      /* ignore: clearing cookies is the security-relevant action */
    }
  }
  clearSessionCookies();
  return NextResponse.json({ ok: true });
}
