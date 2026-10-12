import { createSeedanceTask, normalizeSeedanceTask } from '@/lib/seedance';
import { createReadUrl } from '@/lib/storage';
import { NextResponse } from 'next/server';
import { hasAccess } from '@/lib/access';
import { takeQuota } from '@/lib/limits';

const isInputKey = (value: unknown) => typeof value === 'string' && /^inputs\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.[a-z0-9]{1,8}$/.test(value);

export async function POST(request: Request) {
  try {
    if (!hasAccess(request)) return NextResponse.json({ error: 'Invalid access key' }, { status: 401 });
    if (!process.env.APP_ACCESS_KEY && process.env.ARK_API_KEY && !request.headers.get('x-seedance-api-key')) return NextResponse.json({ error: 'Paid server API usage requires workspace protection' }, { status: 403 });
    if (!takeQuota(request, 'generations', 12)) return NextResponse.json({ error: 'Hourly generation quota exceeded' }, { status: 429 });
    const apiKey = request.headers.get('x-seedance-api-key')?.trim() || process.env.ARK_API_KEY;
    if (!apiKey || apiKey.length > 512 || !/^[\x21-\x7e]+$/.test(apiKey)) return NextResponse.json({ error: 'Enter a valid Seedance API key' }, { status: 401 });
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
    if (!isInputKey(input.videoKey) || input.imageKeys.some((key: unknown) => !isInputKey(key)))
      throw new Error('Invalid upload key');
    const prompt = String(input.prompt ?? '').slice(0, 10000);
    const videoMentions = [...prompt.matchAll(/@video\s*(\d+)/gi)].map((match) => Number(match[1]));
    const imageMentions = [...prompt.matchAll(/@image\s*(\d+)/gi)].map((match) => Number(match[1]));
    if (videoMentions.some((index) => index !== 1) || imageMentions.some((index) => index < 1 || index > input.imageKeys.length))
      throw new Error('Prompt contains a reference that is not uploaded');

    const videoUrl = await createReadUrl(input.videoKey);
    const imageUrls = await Promise.all(input.imageKeys.map((key: string) => createReadUrl(key)));
    const count = Math.min(Math.max(Number(input.batch) || 1, 1), 4);
    const tasks = await Promise.all(
      Array.from({ length: count }, () =>
        createSeedanceTask({
          prompt,
          resolution: input.resolution,
          videoUrl,
          imageUrls
        }, apiKey).then(normalizeSeedanceTask)
      )
    );
    return NextResponse.json({ tasks }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to start generation' },
      { status: 400 }
    );
  }
}
