'use client';

import {
  IconAlertCircle,
  IconArrowsExchange,
  IconCheck,
  IconChevronRight,
  IconDownload,
  IconHistory,
  IconInfoCircle,
  IconLayoutGrid,
  IconLoader2,
  IconMovie,
  IconPlayerPlay,
  IconPlus,
  IconSparkles,
  IconTrash,
  IconUpload,
  IconWand,
  IconX
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type View = 'create' | 'history' | 'library' | 'how';
type Quality = '480p' | '720p' | '1080p';
type JobStatus = 'queued' | 'processing' | 'succeeded' | 'failed';

interface UploadAsset {
  id: string;
  name: string;
  key: string;
  preview: string;
  progress: number;
  duration?: number;
}

interface Job {
  id: string;
  createdAt: string;
  status: JobStatus;
  videoUrl?: string | null;
  error?: string | null;
  quality: Quality;
  prompt: string;
  sourcePreview?: string;
  completionTokens?: number | null;
  costUsd?: number | null;
}

const styles = ['Natural', 'Cinematic', 'Editorial', 'Anime', 'Claymation', 'Product film'];
const presets = [
  {
    title: 'Runway walk',
    subtitle: 'Full body · tracking camera',
    icon: '↗',
    prompt: 'Keep the confident runway pacing and full-body framing.'
  },
  {
    title: 'Fight choreography',
    subtitle: 'Fast action · wide lens',
    icon: '✦',
    prompt: 'Preserve the precise fight choreography and rapid camera movement.'
  },
  {
    title: 'Dance loop',
    subtitle: 'Rhythmic · fixed lens',
    icon: '⌁',
    prompt: 'Transfer the dance exactly with stable hands and rhythmic timing.'
  },
  {
    title: 'Product orbit',
    subtitle: 'Studio · macro details',
    icon: '◉',
    prompt: 'Preserve the smooth orbital camera path and premium product lighting.'
  },
  {
    title: 'Dialogue scene',
    subtitle: 'Two-shot · natural motion',
    icon: '◇',
    prompt: 'Keep the dialogue timing, eye lines, gestures, and shot continuity.'
  },
  {
    title: 'Handheld chase',
    subtitle: 'Dynamic · cinematic',
    icon: '↯',
    prompt: 'Retain the handheld urgency, subject trajectory, and camera shake.'
  }
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

async function json<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? 'Request failed');
  return body;
}

function uploadFile(file: File, kind: 'video' | 'image', onProgress: (progress: number) => void) {
  return fetch('/api/uploads/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentType: file.type, kind })
  })
    .then((response) => json<{ objectKey: string; uploadUrl: string }>(response))
    .then(
      ({ objectKey, uploadUrl }) =>
        new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', uploadUrl);
          xhr.setRequestHeader('Content-Type', file.type);
          xhr.upload.onprogress = (event) =>
            event.lengthComputable && onProgress(Math.round((event.loaded / event.total) * 100));
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve(objectKey)
              : reject(new Error('Upload failed'));
          xhr.onerror = () => reject(new Error('Upload failed'));
          xhr.send(file);
        })
    );
}

export default function MotionStudio() {
  const [view, setView] = useState<View>('create');
  const [video, setVideo] = useState<UploadAsset | null>(null);
  const [images, setImages] = useState<UploadAsset[]>([]);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('Natural');
  const [quality, setQuality] = useState<Quality>('720p');
  const [batch, setBatch] = useState(1);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const videoInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('jujistsu-jobs');
    // Browser-local history is intentionally hydrated after the first client render.
    // oxlint-disable-next-line react/set-state-in-effect
    if (stored) setJobs(JSON.parse(stored));
  }, []);

  useEffect(() => {
    localStorage.setItem('jujistsu-jobs', JSON.stringify(jobs.slice(0, 40)));
  }, [jobs]);

  const updateJob = useCallback((id: string, update: Partial<Job>) => {
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...update } : job)));
  }, []);

  useEffect(() => {
    const active = jobs.filter((job) => job.status === 'queued' || job.status === 'processing');
    if (!active.length) return;
    const timer = window.setInterval(async () => {
      await Promise.all(
        active.map(async (job) => {
          try {
            const data = await json<{
              status: string;
              videoUrl?: string;
              error?: string;
              completionTokens?: number;
              costUsd?: number;
            }>(await fetch(`/api/generations/${job.id}`));
            const status =
              data.status === 'succeeded'
                ? 'succeeded'
                : data.status === 'failed' || data.status === 'expired'
                  ? 'failed'
                  : 'processing';
            updateJob(job.id, {
              status,
              videoUrl: data.videoUrl,
              error: data.error,
              completionTokens: data.completionTokens,
              costUsd: data.costUsd
            });
          } catch (pollError) {
            updateJob(job.id, {
              error: pollError instanceof Error ? pollError.message : 'Status check failed'
            });
          }
        })
      );
    }, 5000);
    return () => window.clearInterval(timer);
  }, [jobs, updateJob]);

  const handleVideo = async (file?: File) => {
    if (!file) return;
    setError(null);
    if (file.size > 200 * 1024 * 1024) return setError('Video must be 200 MB or smaller.');
    const preview = URL.createObjectURL(file);
    const draft: UploadAsset = {
      id: crypto.randomUUID(),
      name: file.name,
      key: '',
      preview,
      progress: 0
    };
    setVideo(draft);
    setUploading((value) => value + 1);
    try {
      const key = await uploadFile(file, 'video', (progress) =>
        setVideo((current) => (current ? { ...current, progress } : null))
      );
      setVideo((current) => (current ? { ...current, key, progress: 100 } : null));
    } catch (uploadError) {
      setVideo(null);
      setError(uploadError instanceof Error ? uploadError.message : 'Video upload failed');
    } finally {
      setUploading((value) => value - 1);
    }
  };

  const handleImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const selected = Array.from(files).slice(0, 30 - images.length);
    await Promise.all(
      selected.map(async (file) => {
        if (file.size > 30 * 1024 * 1024)
          return setError(`${file.name} exceeds the 30 MB image limit.`);
        const draft: UploadAsset = {
          id: crypto.randomUUID(),
          name: file.name,
          key: '',
          preview: URL.createObjectURL(file),
          progress: 0
        };
        setImages((current) => [...current, draft]);
        setUploading((value) => value + 1);
        try {
          const key = await uploadFile(file, 'image', (progress) =>
            setImages((current) =>
              current.map((item) => (item.id === draft.id ? { ...item, progress } : item))
            )
          );
          setImages((current) =>
            current.map((item) => (item.id === draft.id ? { ...item, key, progress: 100 } : item))
          );
        } catch (uploadError) {
          setImages((current) => current.filter((item) => item.id !== draft.id));
          setError(uploadError instanceof Error ? uploadError.message : 'Image upload failed');
        } finally {
          setUploading((value) => value - 1);
        }
      })
    );
  };

  const generate = async () => {
    setError(null);
    if (!video?.key || !images.length || images.some((image) => !image.key)) {
      return setError('Upload one source video and at least one reference image first.');
    }
    try {
      const data = await json<{ tasks: Array<{ id: string; status: string }> }>(
        await fetch('/api/generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            style,
            resolution: quality,
            batch,
            videoKey: video.key,
            imageKeys: images.map((image) => image.key)
          })
        })
      );
      const created = data.tasks.map<Job>((task) => ({
        id: task.id,
        createdAt: new Date().toISOString(),
        status: task.status === 'succeeded' ? 'succeeded' : 'queued',
        quality,
        prompt,
        sourcePreview: video.preview
      }));
      setJobs((current) => [...created, ...current]);
      setView('history');
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Generation failed');
    }
  };

  const currentResult = jobs.find((job) => job.status === 'succeeded' && job.videoUrl);
  const activeJobs = jobs.filter(
    (job) => job.status === 'queued' || job.status === 'processing'
  ).length;
  const canGenerate = Boolean(video?.key && images.some((image) => image.key) && !uploading);
  const estimatedCost = useMemo(() => {
    if (!video?.duration) return null;
    const pixels = quality === '480p' ? 864 * 480 : quality === '720p' ? 1248 * 704 : 1920 * 1080;
    const tokens = (video.duration * 2 * pixels * 24) / 1024;
    return (tokens / 1_000_000) * (quality === '1080p' ? 7 : 6.4) * batch;
  }, [quality, batch, video?.duration]);

  return (
    <main className='min-h-screen bg-[#090807] pb-20 text-white selection:bg-[#e86722] selection:text-white md:pb-0'>
      <header className='sticky top-0 z-40 border-b border-white/8 bg-[#080908]/88 backdrop-blur-xl'>
        <div className='mx-auto flex h-16 max-w-[1680px] items-center justify-between px-4 sm:px-7'>
          <button onClick={() => setView('create')} className='flex items-center gap-3 rounded-lg'>
            <span className='grid size-8 place-items-center rounded-[10px] bg-[#e86722] text-white'>
              <IconArrowsExchange size={18} stroke={2.3} />
            </span>
            <span className='text-[15px] font-semibold tracking-[-0.02em]'>JUJISTSU</span>
            <span className='hidden rounded-full border border-white/10 bg-white/[.04] px-2 py-0.5 text-[10px] font-medium text-white/45 sm:inline'>
              SEEDANCE 2.5
            </span>
          </button>
          <nav className='hidden items-center gap-1 md:flex'>
            {(
              [
                ['create', 'Create', IconWand],
                ['history', 'History', IconHistory],
                ['library', 'Motion library', IconLayoutGrid],
                ['how', 'How it works', IconInfoCircle]
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={cx(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition',
                  view === id
                    ? 'bg-white/10 text-white'
                    : 'text-white/45 hover:bg-white/[.05] hover:text-white'
                )}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </nav>
          <div className='flex items-center gap-3 text-xs text-white/50'>
            {activeJobs > 0 && (
              <span className='flex items-center gap-1.5'>
                <span className='size-1.5 animate-pulse rounded-full bg-[#e86722]' />
                {activeJobs} rendering
              </span>
            )}
            <span className='hidden rounded-full border border-white/10 px-3 py-1.5 sm:inline'>
              Private workspace
            </span>
          </div>
        </div>
      </header>

      {view === 'create' && (
        <div className='mx-auto grid max-w-[1680px] gap-5 p-4 sm:p-7 xl:grid-cols-[430px_minmax(0,1fr)]'>
          <section className='studio-enter overflow-hidden rounded-[24px] border border-white/10 bg-[#101110] shadow-2xl shadow-black/30'>
            <div className='border-b border-white/8 px-5 py-5'>
              <div className='mb-1 flex items-center justify-between'>
                <h1 className='text-xl font-semibold tracking-[-0.035em]'>Create transformation</h1>
                <span className='text-[11px] text-white/35'>4–30 seconds</span>
              </div>
              <p className='text-sm leading-5 text-white/45'>
                Source motion in. A completely new subject out.
              </p>
            </div>

            <div className='space-y-6 p-5'>
              <FieldLabel step='01' title='Source motion' note='MP4 or MOV · max 200 MB' />
              <input
                ref={videoInput}
                hidden
                type='file'
                accept='video/mp4,video/quicktime'
                onChange={(event) => handleVideo(event.target.files?.[0])}
              />
              {video ? (
                <div className='group relative overflow-hidden rounded-2xl border border-white/10 bg-black'>
                  <video
                    src={video.preview}
                    className='h-44 w-full object-cover opacity-75'
                    muted
                    playsInline
                    onLoadedMetadata={(event) =>
                      setVideo((current) =>
                        current ? { ...current, duration: event.currentTarget.duration } : null
                      )
                    }
                  />
                  <div className='absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black via-black/70 to-transparent px-4 pb-3 pt-10'>
                    <div className='min-w-0'>
                      <p className='truncate text-xs font-medium'>{video.name}</p>
                      <p className='mt-0.5 text-[10px] text-white/45'>
                        {video.progress < 100
                          ? `Uploading ${video.progress}%`
                          : 'Ready · motion source'}
                      </p>
                    </div>
                    <button
                      onClick={() => setVideo(null)}
                      aria-label='Remove source video'
                      className='rounded-full bg-black/60 p-2 text-white/60 hover:text-white'
                    >
                      <IconTrash size={15} />
                    </button>
                  </div>
                  {video.progress < 100 && (
                    <div className='absolute inset-x-0 bottom-0 h-0.5 bg-white/10'>
                      <div
                        className='h-full bg-[#e86722]'
                        style={{ width: `${video.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <DropZone
                  icon={<IconMovie size={22} />}
                  title='Drop your motion video'
                  hint='The camera, timing and movement to preserve'
                  onClick={() => videoInput.current?.click()}
                  onDrop={(files) => handleVideo(files[0])}
                />
              )}

              <FieldLabel
                step='02'
                title='Reference identity'
                note={`${images.length}/30 images`}
              />
              <input
                ref={imageInput}
                hidden
                multiple
                type='file'
                accept='image/*,.heic,.heif'
                onChange={(event) => handleImages(event.target.files)}
              />
              <div className='grid grid-cols-4 gap-2'>
                {images.map((image, index) => (
                  <div
                    key={image.id}
                    className='group relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-black'
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.preview}
                      alt={`Reference ${index + 1}`}
                      className='h-full w-full object-cover'
                    />
                    <span className='absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] text-white/70'>
                      {index + 1}
                    </span>
                    <button
                      onClick={() =>
                        setImages((current) => current.filter((item) => item.id !== image.id))
                      }
                      aria-label={`Remove ${image.name}`}
                      className='absolute right-1.5 top-1.5 rounded-full bg-black/75 p-1 opacity-0 transition group-hover:opacity-100'
                    >
                      <IconX size={12} />
                    </button>
                    {image.progress < 100 && (
                      <div className='absolute inset-x-0 bottom-0 h-0.5 bg-white/15'>
                        <div
                          className='h-full bg-[#e86722]'
                          style={{ width: `${image.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
                {images.length < 30 && (
                  <button
                    onClick={() => imageInput.current?.click()}
                    className='grid aspect-square place-items-center rounded-xl border border-dashed border-white/15 bg-white/[.025] text-white/35 transition hover:border-[#e86722]/50 hover:text-[#e86722]'
                  >
                    <IconPlus size={20} />
                  </button>
                )}
              </div>

              <div className='grid grid-cols-2 gap-3'>
                <label className='space-y-2 text-xs text-white/50'>
                  Style
                  <select
                    value={style}
                    onChange={(event) => setStyle(event.target.value)}
                    className='h-11 w-full appearance-none rounded-xl border border-white/10 bg-[#181a18] px-3 text-sm text-white'
                  >
                    {styles.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label className='space-y-2 text-xs text-white/50'>
                  Variations
                  <select
                    value={batch}
                    onChange={(event) => setBatch(Number(event.target.value))}
                    className='h-11 w-full appearance-none rounded-xl border border-white/10 bg-[#181a18] px-3 text-sm text-white'
                  >
                    {[1, 2, 3, 4].map((count) => (
                      <option key={count} value={count}>
                        {count} output{count > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className='block space-y-2 text-xs text-white/50'>
                Direction <span className='float-right text-[10px] text-white/25'>Optional</span>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  maxLength={10000}
                  placeholder='Describe the character, clothing, scene, or any detail to preserve…'
                  className='min-h-24 w-full resize-none rounded-xl border border-white/10 bg-[#181a18] p-3 text-sm leading-5 text-white placeholder:text-white/25'
                />
              </label>

              <div>
                <div className='mb-2 flex items-center justify-between text-xs text-white/50'>
                  <span>Output quality</span>
                  <span>
                    {estimatedCost
                      ? `~$${estimatedCost.toFixed(2)} estimated`
                      : 'Upload video to estimate'}
                  </span>
                </div>
                <div className='grid grid-cols-3 gap-2'>
                  {(['480p', '720p', '1080p'] as Quality[]).map((item) => (
                    <button
                      key={item}
                      onClick={() => setQuality(item)}
                      className={cx(
                        'rounded-xl border px-3 py-2.5 text-xs transition',
                        quality === item
                          ? 'border-[#e86722]/60 bg-[#e86722]/10 text-[#ff9c62]'
                          : 'border-white/8 bg-white/[.025] text-white/40 hover:text-white/70'
                      )}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className='grid grid-cols-2 gap-3 rounded-xl border border-white/8 bg-black/25 p-3 text-[11px]'>
                <div>
                  <p className='text-white/30'>Official API rate</p>
                  <p className='mt-1 font-medium text-white/70'>
                    {quality === '1080p' ? '$7.00' : '$6.40'} / 1M tokens
                  </p>
                </div>
                <div>
                  <p className='text-white/30'>Account balance</p>
                  <p className='mt-1 font-medium text-white/70'>BytePlus Console</p>
                </div>
                <p className='col-span-2 leading-4 text-white/25'>
                  Final charge uses actual completion tokens. The generation API does not expose
                  account balance.
                </p>
              </div>

              {error && (
                <div className='flex gap-2 rounded-xl border border-red-400/20 bg-red-400/[.06] p-3 text-xs leading-5 text-red-200'>
                  <IconAlertCircle className='mt-0.5 shrink-0' size={15} />
                  {error}
                </div>
              )}

              <button
                onClick={generate}
                disabled={!canGenerate}
                className='group flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#e86722] text-sm font-semibold text-white transition hover:bg-[#f07935] disabled:cursor-not-allowed disabled:bg-white/8 disabled:text-white/25'
              >
                {uploading ? (
                  <IconLoader2 className='animate-spin' size={18} />
                ) : (
                  <IconSparkles size={18} />
                )}
                {uploading
                  ? `Uploading ${uploading} file${uploading > 1 ? 's' : ''}`
                  : `Generate motion transfer${estimatedCost ? ` · ~$${estimatedCost.toFixed(2)}` : ''}`}
                {!uploading && (
                  <IconChevronRight
                    className='transition-transform group-hover:translate-x-0.5'
                    size={16}
                  />
                )}
              </button>
            </div>
          </section>

          <section className='studio-enter-delay min-h-[720px] overflow-hidden rounded-[24px] border border-white/10 bg-[#0d0f0e]'>
            <div className='flex h-14 items-center justify-between border-b border-white/8 px-5'>
              <div className='flex items-center gap-2'>
                <span className='size-2 rounded-full bg-[#e86722]' />
                <span className='text-xs font-medium'>Output monitor</span>
              </div>
              <div className='flex items-center gap-2 text-[10px] text-white/35'>
                <span>Adaptive ratio</span>
                <span>·</span>
                <span>Audio preserved</span>
                <span>·</span>
                <span>No watermark</span>
              </div>
            </div>
            {currentResult ? (
              <ResultViewer job={currentResult} />
            ) : (
              <EmptyMonitor onLibrary={() => setView('library')} />
            )}
          </section>
        </div>
      )}

      {view === 'history' && (
        <HistoryView jobs={jobs} setJobs={setJobs} onCreate={() => setView('create')} />
      )}
      {view === 'library' && (
        <LibraryView
          onUse={(preset) => {
            setPrompt(preset.prompt);
            setView('create');
          }}
        />
      )}
      {view === 'how' && <HowItWorks onCreate={() => setView('create')} />}

      <nav className='fixed inset-x-3 bottom-3 z-50 grid grid-cols-4 rounded-2xl border border-white/10 bg-[#111311]/95 p-1.5 shadow-2xl shadow-black backdrop-blur-xl md:hidden'>
        {(
          [
            ['create', 'Create', IconWand],
            ['history', 'History', IconHistory],
            ['library', 'Library', IconLayoutGrid],
            ['how', 'Guide', IconInfoCircle]
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={cx(
              'flex flex-col items-center gap-1 rounded-xl py-2 text-[9px] transition',
              view === id ? 'bg-white/8 text-[#e86722]' : 'text-white/35'
            )}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </nav>
    </main>
  );
}

function FieldLabel({ step, title, note }: { step: string; title: string; note: string }) {
  return (
    <div className='-mb-3 flex items-center justify-between'>
      <div className='flex items-center gap-2'>
        <span className='font-mono text-[9px] text-[#e86722]/70'>{step}</span>
        <h2 className='text-xs font-medium'>{title}</h2>
      </div>
      <span className='text-[10px] text-white/30'>{note}</span>
    </div>
  );
}

function DropZone({
  icon,
  title,
  hint,
  onClick,
  onDrop
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
  onDrop: (files: FileList) => void;
}) {
  return (
    <button
      onClick={onClick}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(event.dataTransfer.files);
      }}
      className='group flex w-full items-center gap-4 rounded-2xl border border-dashed border-white/15 bg-white/[.025] p-5 text-left transition hover:border-[#e86722]/45 hover:bg-[#e86722]/[.035]'
    >
      <span className='grid size-11 shrink-0 place-items-center rounded-xl bg-white/[.06] text-white/45 transition group-hover:text-[#e86722]'>
        {icon}
      </span>
      <span>
        <span className='block text-sm font-medium'>{title}</span>
        <span className='mt-1 block text-xs text-white/35'>{hint}</span>
      </span>
      <IconUpload className='ml-auto text-white/25' size={17} />
    </button>
  );
}

function EmptyMonitor({ onLibrary }: { onLibrary: () => void }) {
  return (
    <div className='relative grid min-h-[664px] place-items-center overflow-hidden p-8'>
      <div
        className='absolute inset-0 opacity-30'
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }}
      />
      <div className='relative max-w-md text-center'>
        <div className='mx-auto mb-6 grid size-20 place-items-center rounded-full border border-white/10 bg-white/[.025]'>
          <div className='grid size-12 place-items-center rounded-full bg-[#c5ff4a]/10 text-[#c5ff4a]'>
            <IconPlayerPlay size={22} />
          </div>
        </div>
        <h2 className='text-2xl font-medium tracking-[-0.04em]'>
          Your transformation appears here
        </h2>
        <p className='mx-auto mt-3 max-w-sm text-sm leading-6 text-white/40'>
          Upload motion and references, then render a new scene that keeps every beat of the
          original performance.
        </p>
        <button
          onClick={onLibrary}
          className='mt-6 rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-xs text-white/60 transition hover:bg-white/[.08] hover:text-white'
        >
          Explore motion presets
        </button>
      </div>
      <div className='absolute bottom-6 left-6 right-6 grid grid-cols-3 gap-3'>
        {['MOTION', 'IDENTITY', 'RENDER'].map((item, index) => (
          <div key={item} className='rounded-xl border border-white/6 bg-black/30 p-3'>
            <div className='mb-2 flex items-center gap-2'>
              <span
                className={cx(
                  'size-1.5 rounded-full',
                  index === 0 ? 'bg-[#c5ff4a]' : 'bg-white/20'
                )}
              />
              <span className='font-mono text-[9px] text-white/30'>{item}</span>
            </div>
            <div className='h-1 overflow-hidden rounded-full bg-white/[.05]'>
              <div
                className={cx('h-full rounded-full', index === 0 ? 'w-1/3 bg-[#c5ff4a]/50' : 'w-0')}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultViewer({ job }: { job: Job }) {
  return (
    <div className='p-5'>
      <div className='grid gap-4 lg:grid-cols-2'>
        <VideoFrame label='SOURCE' url={job.sourcePreview} />
        <VideoFrame label='RESULT' url={job.videoUrl ?? undefined} accent />
      </div>
      <div className='mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[.025] p-4'>
        <div>
          <p className='text-xs font-medium'>Motion transfer complete</p>
          <p className='mt-1 text-[10px] text-white/35'>
            {job.quality} · audio preserved · {job.completionTokens?.toLocaleString() ?? '—'} tokens
            · {job.costUsd ? `$${job.costUsd.toFixed(2)} actual` : 'cost pending'} ·{' '}
            {new Date(job.createdAt).toLocaleString()}
          </p>
        </div>
        <div className='flex gap-2'>
          <a
            href={job.videoUrl ?? '#'}
            download
            target='_blank'
            rel='noreferrer'
            className='flex items-center gap-2 rounded-lg bg-[#e86722] px-3 py-2 text-xs font-semibold text-white'
          >
            <IconDownload size={15} /> Download
          </a>
        </div>
      </div>
    </div>
  );
}

function VideoFrame({ label, url, accent }: { label: string; url?: string; accent?: boolean }) {
  return (
    <div
      className={cx(
        'overflow-hidden rounded-2xl border bg-black',
        accent ? 'border-[#c5ff4a]/30' : 'border-white/10'
      )}
    >
      <div className='flex items-center justify-between border-b border-white/8 px-3 py-2'>
        <span className='font-mono text-[9px] text-white/40'>{label}</span>
        {accent && (
          <span className='flex items-center gap-1 text-[9px] text-[#c5ff4a]'>
            <IconCheck size={11} /> COMPLETE
          </span>
        )}
      </div>
      {url ? (
        <video
          controls
          autoPlay={accent}
          loop
          src={url}
          className='aspect-video w-full object-contain'
          aria-label={`${label.toLowerCase()} video`}
        >
          <track kind='captions' srcLang='en' label='Captions unavailable' />
        </video>
      ) : (
        <div className='grid aspect-video place-items-center text-xs text-white/25'>
          Preview unavailable after reload
        </div>
      )}
    </div>
  );
}

function HistoryView({
  jobs,
  setJobs,
  onCreate
}: {
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  onCreate: () => void;
}) {
  return (
    <section className='mx-auto max-w-6xl p-5 sm:p-10'>
      <PageHeading
        eyebrow='RENDER QUEUE'
        title='Generation history'
        description='Every variation, status, and result in this browser.'
        action={
          <button
            onClick={onCreate}
            className='rounded-xl bg-[#c5ff4a] px-4 py-2.5 text-xs font-semibold text-black'
          >
            New transformation
          </button>
        }
      />
      {!jobs.length ? (
        <div className='mt-12 rounded-3xl border border-dashed border-white/10 py-24 text-center'>
          <IconHistory className='mx-auto text-white/20' size={32} />
          <p className='mt-4 text-sm text-white/40'>No generations yet.</p>
        </div>
      ) : (
        <div className='mt-8 grid gap-3'>
          {jobs.map((job) => (
            <article
              key={job.id}
              className='flex flex-col gap-4 rounded-2xl border border-white/8 bg-white/[.025] p-4 sm:flex-row sm:items-center'
            >
              <div className='grid size-12 shrink-0 place-items-center rounded-xl bg-black text-white/35'>
                {job.status === 'succeeded' ? (
                  <IconCheck className='text-[#e86722]' />
                ) : job.status === 'failed' ? (
                  <IconAlertCircle className='text-red-400' />
                ) : (
                  <IconLoader2 className='animate-spin' />
                )}
              </div>
              <div className='min-w-0 flex-1'>
                <div className='flex items-center gap-2'>
                  <p className='text-sm font-medium'>Motion transfer</p>
                  <StatusBadge status={job.status} />
                </div>
                <p className='mt-1 truncate text-xs text-white/35'>
                  {job.prompt || 'Default precision transfer prompt'} · {job.quality}
                  {job.costUsd ? ` · $${job.costUsd.toFixed(2)} actual` : ''}
                </p>
                <p className='mt-1 font-mono text-[9px] text-white/20'>{job.id}</p>
                {job.error && <p className='mt-2 text-xs text-red-300'>{job.error}</p>}
              </div>
              <div className='flex gap-2'>
                {job.videoUrl && (
                  <a
                    href={job.videoUrl}
                    target='_blank'
                    rel='noreferrer'
                    className='rounded-lg border border-white/10 p-2 text-white/50 hover:text-white'
                    aria-label='Download result'
                  >
                    <IconDownload size={17} />
                  </a>
                )}
                <button
                  onClick={() => setJobs((current) => current.filter((item) => item.id !== job.id))}
                  className='rounded-lg border border-white/10 p-2 text-white/30 hover:text-red-300'
                  aria-label='Remove from history'
                >
                  <IconTrash size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span
      className={cx(
        'rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider',
        status === 'succeeded'
          ? 'bg-[#c5ff4a]/10 text-[#c5ff4a]'
          : status === 'failed'
            ? 'bg-red-400/10 text-red-300'
            : 'bg-amber-300/10 text-amber-200'
      )}
    >
      {status}
    </span>
  );
}

function LibraryView({ onUse }: { onUse: (preset: (typeof presets)[number]) => void }) {
  return (
    <section className='mx-auto max-w-6xl p-5 sm:p-10'>
      <PageHeading
        eyebrow='MOTION LIBRARY'
        title='Start with a proven movement'
        description='Reusable direction presets for common production shots.'
      />
      <div className='mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {presets.map((preset, index) => (
          <button
            key={preset.title}
            aria-label={`Use ${preset.title} preset`}
            onClick={() => onUse(preset)}
            className='group overflow-hidden rounded-2xl border border-white/8 bg-[#101210] text-left transition hover:-translate-y-1 hover:border-[#c5ff4a]/30'
          >
            <div className='relative grid aspect-[16/9] place-items-center overflow-hidden bg-black'>
              <div
                className='absolute inset-0 opacity-60'
                style={{
                  background: `radial-gradient(circle at ${20 + index * 13}% ${30 + (index % 2) * 35}%, rgba(197,255,74,.16), transparent 30%), linear-gradient(${120 + index * 15}deg, #171a17, #060706)`
                }}
              />
              <span className='relative text-4xl font-light text-[#c5ff4a]/80'>{preset.icon}</span>
              <span className='absolute bottom-3 right-3 grid size-8 place-items-center rounded-full bg-white text-black opacity-0 transition group-hover:opacity-100'>
                <IconPlayerPlay size={14} />
              </span>
            </div>
            <div className='p-4'>
              <h3 className='text-sm font-medium'>{preset.title}</h3>
              <p className='mt-1 text-xs text-white/35'>{preset.subtitle}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function HowItWorks({ onCreate }: { onCreate: () => void }) {
  const steps = [
    [
      '01',
      'Motion is the blueprint',
      'The source clip defines action, timing, camera movement, framing, and audio.'
    ],
    [
      '02',
      'References define identity',
      'Add up to 30 images for the character, clothing, product, location, or visual language.'
    ],
    [
      '03',
      'Direction controls the edit',
      'Add precise constraints, then Seedance 2.5 rebuilds the character while retaining the performance.'
    ]
  ];
  return (
    <section className='mx-auto max-w-5xl p-5 sm:p-10'>
      <PageHeading
        eyebrow='WORKFLOW'
        title='One performance. Any identity.'
        description='A direct, production-focused motion transfer pipeline.'
      />
      <div className='mt-12 grid gap-px overflow-hidden rounded-3xl border border-white/8 bg-white/8 md:grid-cols-3'>
        {steps.map(([number, title, copy]) => (
          <article key={number} className='bg-[#0e100f] p-7'>
            <span className='font-mono text-[10px] text-[#c5ff4a]'>{number}</span>
            <h3 className='mt-14 text-xl font-medium tracking-[-0.03em]'>{title}</h3>
            <p className='mt-3 text-sm leading-6 text-white/40'>{copy}</p>
          </article>
        ))}
      </div>
      <div className='mt-8 flex justify-center'>
        <button
          onClick={onCreate}
          className='flex items-center gap-2 rounded-xl bg-[#c5ff4a] px-5 py-3 text-sm font-semibold text-black'
        >
          Open the studio <IconChevronRight size={16} />
        </button>
      </div>
    </section>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className='flex flex-col gap-5 border-b border-white/8 pb-8 sm:flex-row sm:items-end sm:justify-between'>
      <div>
        <p className='font-mono text-[10px] tracking-[.2em] text-[#c5ff4a]'>{eyebrow}</p>
        <h1 className='mt-3 text-4xl font-semibold tracking-[-0.055em]'>{title}</h1>
        <p className='mt-3 text-sm text-white/40'>{description}</p>
      </div>
      {action}
    </div>
  );
}
