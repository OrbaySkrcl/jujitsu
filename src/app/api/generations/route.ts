import { createSeedanceTask, normalizeSeedanceTask } from '@/lib/seedance';
import { createReadUrl } from '@/lib/storage';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
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

    const videoUrl = await createReadUrl(input.videoKey);
    const imageUrls = await Promise.all(input.imageKeys.map((key: string) => createReadUrl(key)));
    const count = Math.min(Math.max(Number(input.batch) || 1, 1), 4);
    const tasks = await Promise.all(
      Array.from({ length: count }, () =>
        createSeedanceTask({
          prompt: String(input.prompt ?? '').slice(0, 10000),
          style: String(input.style ?? '').slice(0, 200),
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
