import { hasAccess } from '@/lib/access';
import { verifySeedanceApiKey } from '@/lib/seedance';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  if (!hasAccess(request))
    return NextResponse.json({ error: 'Invalid workspace access key' }, { status: 401 });
  const apiKey = request.headers.get('x-seedance-api-key')?.trim() ?? '';
  if (!apiKey || apiKey.length > 512 || !/^[\x21-\x7e]+$/.test(apiKey))
    return NextResponse.json({ connected: false, error: 'Enter a valid API key' }, { status: 400 });
  try {
    const connected = await verifySeedanceApiKey(apiKey);
    return NextResponse.json(
      connected ? { connected: true } : { connected: false, error: 'BytePlus rejected this API key' },
      { status: connected ? 200 : 401, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json(
      { connected: false, error: 'Could not reach Seedance' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
