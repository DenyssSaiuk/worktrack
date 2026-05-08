/* The WebSocket endpoint authenticates by query-string token. The httpOnly
 * cookie can't be read from JS, so this server route mints a short-lived
 * copy that's allowed to leave the cookie jar — handed to the WS client and
 * then discarded. */
import { NextResponse } from 'next/server';

import { getAccessToken } from '../../../../lib/session';

export async function GET(): Promise<NextResponse> {
  const token = getAccessToken();
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ token });
}
