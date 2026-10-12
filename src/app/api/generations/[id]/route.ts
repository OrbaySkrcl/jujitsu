import { getSeedanceTask, normalizeSeedanceTask } from '@/lib/seedance';
import { NextResponse } from 'next/server';
import { hasAccess } from '@/lib/access';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!hasAccess(request)) return NextResponse.json({ error: 'Invalid access key' }, { status: 401 });
    const apiKey = request.headers.get('x-seedance-api-key')?.trim() || process.env.ARK_API_KEY;
    if (!apiKey || apiKey.length > 512 || !/^[\x21-\x7e]+$/.test(apiKey)) return NextResponse.json({ error: 'Enter a valid Seedance API key' }, { status: 401 });
    const { id } = await params;
    return NextResponse.json(normalizeSeedanceTask(await getSeedanceTask(id, apiKey)), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to read task' },
      { status: 502 }
    );
  }
}
