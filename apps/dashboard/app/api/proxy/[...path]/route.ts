/* Generic backend proxy that attaches the httpOnly access token. */
import { NextResponse } from 'next/server';

import { getAccessToken } from '../../../../lib/session';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:7340';

async function handler(
  req: Request,
  { params }: { params: { path: string[] } },
): Promise<NextResponse> {
  const token = getAccessToken();
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const path = params.path.join('/');
  const search = new URL(req.url).search;
  const target = `${BACKEND_URL}/api/v1/${path}${search}`;

  const init: RequestInit = {
    method: req.method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const text = await req.text();
    if (text) init.body = text;
  }

  const upstream = await fetch(target, init);
  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
  });
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
export const PUT = handler;
