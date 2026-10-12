export const SEEDANCE_ENDPOINT =
  process.env.SEEDANCE_API_BASE_URL ??
  'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks';

export const SEEDANCE_MODEL = process.env.SEEDANCE_MODEL ?? 'dreamina-seedance-2-5-260628';

export interface GenerationInput {
  prompt?: string;
  resolution: '480p' | '720p' | '1080p';
  videoUrl: string;
  imageUrls: string[];
}

function requiredApiKey() {
  const key = process.env.ARK_API_KEY;
  if (!key) throw new Error('ARK_API_KEY is not configured');
  return key;
}

function buildPrompt(input: GenerationInput) {
  const imageRefs = input.imageUrls.map((_, index) => `@Image ${index + 1}`).join(', ');
  const instruction = `This is a video editing task. @Video 1 is the master clip; preserve its camera movement, pacing, duration, composition, shot order, cuts, expressions, actions, poses, timing, lighting, background, and original audio. ${imageRefs} define the same replacement character's face, hairstyle, body shape, clothing, and accessories; do not use the image backgrounds. Replace the main character in @Video 1 with the character defined by ${imageRefs}. The replacement inherits the original character's on-screen timing, position, pose, full motion path, hand motion, facial timing, occlusions, entrances, and exits. Keep every other subject and element unchanged. Do not change framing or add or remove anything else.`;

  return [instruction, input.prompt ?? '']
    .filter(Boolean)
    .join(' ');
}

export async function createSeedanceTask(input: GenerationInput) {
  const response = await fetch(SEEDANCE_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requiredApiKey()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: SEEDANCE_MODEL,
      content: [
        { type: 'text', text: buildPrompt(input) },
        { type: 'video_url', video_url: { url: input.videoUrl }, role: 'reference_video' },
        ...input.imageUrls.map((url) => ({
          type: 'image_url',
          image_url: { url },
          role: 'reference_image'
        }))
      ],
      omni_reference_task_type: 'edit',
      ratio: 'adaptive',
      duration: -1,
      resolution: input.resolution,
      generate_audio: true,
      watermark: false
    })
  });

  const data = await response.json();
  if (!response.ok)
    throw new Error(data?.error?.message ?? data?.message ?? 'Seedance rejected the task');
  return data;
}

export async function getSeedanceTask(id: string) {
  const response = await fetch(`${SEEDANCE_ENDPOINT}/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${requiredApiKey()}` },
    cache: 'no-store'
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data?.error?.message ?? data?.message ?? 'Unable to read task status');
  return data;
}

export function normalizeSeedanceTask(data: Record<string, unknown>) {
  const nested = typeof data.data === 'object' && data.data ? data.data as Record<string, unknown> : {};
  const content = typeof data.content === 'object' && data.content ? data.content as Record<string, unknown> : {};
  const nestedContent = typeof nested.content === 'object' && nested.content ? nested.content as Record<string, unknown> : {};
  const usage = typeof data.usage === 'object' && data.usage ? data.usage as Record<string, unknown> : {};
  const nestedUsage = typeof nested.usage === 'object' && nested.usage ? nested.usage as Record<string, unknown> : {};
  const failure = typeof data.error === 'object' && data.error ? data.error as Record<string, unknown> : {};
  const status = String(data.status ?? nested.status ?? 'queued').toLowerCase();
  const id = String(data.id ?? nested.id ?? data.task_id ?? nested.task_id ?? '');
  const videoUrl =
    content.video_url ?? nestedContent.video_url ??
    null;
  const error = failure.message ?? data.message ?? null;
  const completionTokens =
    Number(usage.completion_tokens ?? nestedUsage.completion_tokens) || null;
  const resolution = String(data.resolution ?? nested.resolution ?? '');
  const costUsd = completionTokens
    ? (completionTokens / 1_000_000) * (resolution === '1080p' ? 7 : 6.4)
    : null;
  return { id, status, videoUrl, error, completionTokens, costUsd };
}
