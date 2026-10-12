import { accessRequired } from '@/lib/access';
import { SEEDANCE_MODEL } from '@/lib/seedance';
import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    serverApiConfigured: Boolean(process.env.ARK_API_KEY),
    accessRequired: accessRequired(),
    model: SEEDANCE_MODEL
  }, { headers: { 'Cache-Control': 'no-store' } });
}
