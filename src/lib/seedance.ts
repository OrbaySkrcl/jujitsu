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

function requiredApiKey(apiKey?: string) {
  const key = apiKey || process.env.ARK_API_KEY;
  if (!key) throw new Error('ARK_API_KEY is not configured');
  return key;
}

function normalizeReferences(prompt: string) {
  return prompt
    .replace(/@video\s*(\d+)/gi, '@Video $1')
    .replace(/@image\s*(\d+)/gi, '@Image $1');
}

function buildPrompt(input: GenerationInput) {
  const prompt = normalizeReferences(input.prompt ?? '').trim();
  if (!prompt) {
    return 'This is a video editing task. Edit @Video 1. Replace the main character in @Video 1 with the character in @Image 1. Preserve the source camera movement, timing, composition, actions, poses, motion path, occlusions, background, and original audio.';
  }
  return `This is a video editing task. Edit @Video 1. ${prompt} Preserve the source timing, camera movement, composition, motion continuity, and original audio unless the prompt explicitly requests otherwise.`;
}

export async function createSeedanceTask(input: GenerationInput, apiKey?: string) {
  const response = await fetch(SEEDANCE_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requiredApiKey(apiKey)}`,
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

export async function getSeedanceTask(id: string, apiKey?: string) {
  const response = await fetch(`${SEEDANCE_ENDPOINT}/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${requiredApiKey(apiKey)}` },
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
