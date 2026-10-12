export const SEEDANCE_ENDPOINT =
  process.env.SEEDANCE_API_BASE_URL ??
  'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks';

export const SEEDANCE_MODEL = process.env.SEEDANCE_MODEL ?? 'dreamina-seedance-2-5-260628';

export interface GenerationInput {
  prompt?: string;
  style?: string;
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
  const imageRefs = input.imageUrls.map((_, index) => `@Image${index + 1}`).join(', ');
  const instruction = `Replace the main subject in @Video1 with the character defined by ${imageRefs}. Preserve the source motion, pose, facial timing, camera movement, framing, scene timing, and audio.`;

  return [instruction, input.style ? `Visual treatment: ${input.style}.` : '', input.prompt ?? '']
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

export function normalizeSeedanceTask(data: Record<string, any>) {
  const status = String(data.status ?? data.data?.status ?? 'queued').toLowerCase();
  const id = String(data.id ?? data.data?.id ?? data.task_id ?? data.data?.task_id ?? '');
  const videoUrl =
    data.content?.video_url ??
    data.data?.content?.video_url ??
    data.result?.video_url ??
    data.data?.result?.video_url ??
    data.output?.video_url ??
    null;
  const error = data.error?.message ?? data.data?.error?.message ?? null;
  const completionTokens =
    Number(data.usage?.completion_tokens ?? data.data?.usage?.completion_tokens) || null;
  const resolution = String(data.resolution ?? data.data?.resolution ?? '');
  const costUsd = completionTokens
    ? (completionTokens / 1_000_000) * (resolution === '1080p' ? 7 : 6.4)
    : null;
  return { id, status, videoUrl, error, completionTokens, costUsd };
}
