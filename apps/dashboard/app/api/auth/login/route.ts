import { NextResponse } from 'next/server';

import { api, ApiException } from '../../../../lib/api';
import { setSessionCookies } from '../../../../lib/session';

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = (await req.json()) as { email: string; password: string };
    const result = await api.login(body.email, body.password);
    await setSessionCookies(
      result.tokens.accessToken,
      result.tokens.refreshToken,
      result.tokens.expiresIn,
    );
    return NextResponse.json({ user: result.user });
  } catch (err) {
    if (err instanceof ApiException) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'login failed' }, { status: 500 });
  }
}
