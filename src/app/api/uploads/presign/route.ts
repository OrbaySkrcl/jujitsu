import { createUploadUrl } from '@/lib/storage';
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
    const { filename, contentType, kind } = await request.json();
    const allowed = kind === 'video' ? VIDEO_TYPES : IMAGE_TYPES;
    if (!filename || !allowed.has(contentType)) {
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
      uploadUrl: await createUploadUrl(objectKey, contentType)
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create upload URL' },
      { status: 500 }
    );
  }
}
