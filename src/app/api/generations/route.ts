import { createSeedanceTask, normalizeSeedanceTask } from '@/lib/seedance';
import { createReadUrl } from '@/lib/storage';
import { NextResponse } from 'next/server';
import { hasAccess } from '@/lib/access';

export async function POST(request: Request) {
  try {
    if (!hasAccess(request)) return NextResponse.json({ error: 'Invalid access key' }, { status: 401 });
    if (!process.env.ARK_API_KEY) return NextResponse.json({ error: 'ARK_API_KEY is not configured' }, { status: 503 });
    const input = await request.json();
    if (!['480p', '720p', '1080p'].includes(input.resolution))
      throw new Error('Invalid resolution');
    if (
      !input.videoKey ||
      !Array.isArray(input.imageKeys) ||
      input.imageKeys.length < 1 ||
      input.imageKeys.length > 30
    ) {
      throw new Error('One source video and 1–30 reference images are required');
    }
    if (!String(input.videoKey).startsWith('inputs/') || input.imageKeys.some((key: unknown) => !String(key).startsWith('inputs/')))
      throw new Error('Invalid upload key');

    const videoUrl = await createReadUrl(input.videoKey);
    const imageUrls = await Promise.all(input.imageKeys.map((key: string) => createReadUrl(key)));
    const count = Math.min(Math.max(Number(input.batch) || 1, 1), 4);
    const tasks = await Promise.all(
      Array.from({ length: count }, () =>
        createSeedanceTask({
          prompt: String(input.prompt ?? '').slice(0, 10000),
          resolution: input.resolution,
          videoUrl,
          imageUrls
        }).then(normalizeSeedanceTask)
      )
    );
    return NextResponse.json({ tasks });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to start generation' },
      { status: 400 }
    );
  }
}
