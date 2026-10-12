import { getSeedanceTask, normalizeSeedanceTask } from '@/lib/seedance';
import { NextResponse } from 'next/server';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json(normalizeSeedanceTask(await getSeedanceTask(id)));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to read task' },
      { status: 502 }
    );
  }
}
