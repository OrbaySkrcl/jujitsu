import { createUploadUrl } from '@/lib/storage';
import { hasAccess } from '@/lib/access';
import { takeQuota } from '@/lib/limits';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime']);
const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
  'image/tiff',
  'image/gif',
  'image/heic',
  'image/heif'
]);

export async function POST(request: Request) {
  try {
    if (!process.env.APP_ACCESS_KEY && process.env.ALLOW_PUBLIC_UPLOADS !== 'true') return NextResponse.json({ error: 'Uploads require a configured workspace access key' }, { status: 503 });
    if (!hasAccess(request)) return NextResponse.json({ error: 'Invalid access key' }, { status: 401 });
    if (!takeQuota(request, 'upload', 200)) return NextResponse.json({ error: 'Hourly upload quota exceeded' }, { status: 429 });
    const { filename, contentType, kind, size } = await request.json();
    if (kind !== 'video' && kind !== 'image')
      return NextResponse.json({ error: 'Invalid upload kind' }, { status: 400 });
    const allowed = kind === 'video' ? VIDEO_TYPES : IMAGE_TYPES;
    const maxSize = kind === 'video' ? 200 * 1024 * 1024 : 30 * 1024 * 1024;
    if (!filename || !allowed.has(contentType) || !Number.isFinite(size) || size < 1 || size > maxSize) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }
    const extension =
      filename
        .split('.')
        .pop()
        ?.replace(/[^a-z0-9]/gi, '')
        .toLowerCase() || 'bin';
    const objectKey = `inputs/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
    return NextResponse.json({
      objectKey,
      uploadUrl: await createUploadUrl(objectKey, contentType, size)
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create upload URL' },
      { status: 500 }
    );
  }
}
