'use client';
/* oxlint-disable jsx-a11y/media-has-caption */

import { Icons } from '@/components/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Quality = '480p' | '720p' | '1080p';
type Status = 'queued' | 'processing' | 'succeeded' | 'failed';
type Connection = 'disconnected' | 'checking' | 'connected' | 'failed';
interface Asset { id: string; name: string; key: string; preview: string; progress: number; duration?: number }
interface Job { id: string; createdAt: string; status: Status; quality: Quality; prompt: string; videoUrl?: string | null; error?: string | null; completionTokens?: number | null; costUsd?: number | null }
interface Config { serverApiConfigured: boolean; accessRequired: boolean; model: string }

const auth = (key: string): HeadersInit => (key ? { 'x-access-key': key } : {});
const generationAuth = (accessKey: string, apiKey: string): HeadersInit => ({
  ...auth(accessKey),
  ...(apiKey ? { 'x-seedance-api-key': apiKey } : {})
});
async function json<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body as T;
}
function savedJobs(): Job[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('jujitsu-jobs') ?? '[]');
    return Array.isArray(value) ? value.filter((item): item is Job => Boolean(item?.id)) : [];
  } catch {
    localStorage.removeItem('jujitsu-jobs');
    return [];
  }
}
async function upload(file: File, kind: 'video' | 'image', key: string, progress: (value: number) => void) {
  const signed = await json<{ objectKey: string; uploadUrl: string }>(await fetch('/api/uploads/presign', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth(key) },
    body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size, kind })
  }));
  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', signed.uploadUrl); request.timeout = 900000;
    request.setRequestHeader('Content-Type', file.type);
    request.upload.onprogress = (event) => event.lengthComputable && progress(Math.round(event.loaded / event.total * 100));
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve(signed.objectKey) : reject(new Error(`Storage rejected upload (${request.status})`));
    request.onerror = () => reject(new Error('Upload blocked. Check storage CORS.'));
    request.onabort = () => reject(new Error('Upload cancelled.'));
    request.ontimeout = () => reject(new Error('Upload timed out.'));
    request.send(file);
  });
}

export default function MotionStudio() {
  const [video, setVideo] = useState<Asset | null>(null);
  const [images, setImages] = useState<Asset[]>([]);
  const [prompt, setPrompt] = useState(''); const [quality, setQuality] = useState<Quality>('720p');
  const [batch, setBatch] = useState(1); const [jobs, setJobs] = useState<Job[]>([]);
  const [history, setHistory] = useState(false); const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0); const [config, setConfig] = useState<Config | null>(null);
  const [accessKey, setAccessKey] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [connection, setConnection] = useState<Connection>('disconnected');
  const videoInput = useRef<HTMLInputElement>(null); const imageInput = useRef<HTMLInputElement>(null);
  const promptInput = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Browser-only persisted state must hydrate after the server render.
    // oxlint-disable react/set-state-in-effect
    const savedAccessKey = sessionStorage.getItem('jujitsu-access-key') ?? '';
    const savedApiKey = sessionStorage.getItem('jujitsu-seedance-api-key') ?? '';
    setJobs(savedJobs()); setAccessKey(savedAccessKey); setApiKey(savedApiKey);
    if (savedApiKey) void verifyKey(savedApiKey, savedAccessKey);
    fetch('/api/config').then((response) => json<Config>(response)).then(setConfig).catch(() => setConfig(null));
    // oxlint-enable react/set-state-in-effect
  }, []);
  useEffect(() => localStorage.setItem('jujitsu-jobs', JSON.stringify(jobs.slice(0, 40))), [jobs]);
  const updateJob = useCallback((id: string, update: Partial<Job>) => setJobs((all) => all.map((job) => job.id === id ? { ...job, ...update } : job)), []);
  useEffect(() => {
    const active = jobs.filter((job) => job.status === 'queued' || job.status === 'processing');
    if (!active.length) return;
    const timer = window.setInterval(() => void Promise.all(active.map(async (job) => {
      try {
        const data = await json<{ status: string; videoUrl?: string; error?: string; completionTokens?: number; costUsd?: number }>(await fetch(`/api/generations/${job.id}`, { headers: generationAuth(accessKey, apiKey) }));
        updateJob(job.id, { ...data, status: data.status === 'succeeded' ? 'succeeded' : data.status === 'failed' || data.status === 'expired' ? 'failed' : 'processing' });
      } catch (cause) { updateJob(job.id, { error: cause instanceof Error ? cause.message : 'Status check failed' }); }
    })), 5000);
    return () => window.clearInterval(timer);
  }, [accessKey, apiKey, jobs, updateJob]);

  function insertReference(reference: string) {
    const input = promptInput.current;
    const start = input?.selectionStart ?? prompt.length;
    const end = input?.selectionEnd ?? start;
    const spacer = start > 0 && !/\s/.test(prompt[start - 1] ?? '') ? ' ' : '';
    const next = `${prompt.slice(0, start)}${spacer}${reference} ${prompt.slice(end)}`;
    setPrompt(next);
    requestAnimationFrame(() => {
      const caret = start + spacer.length + reference.length + 1;
      input?.focus(); input?.setSelectionRange(caret, caret);
    });
  }

  async function verifyKey(key = apiKey, workspaceKey = accessKey) {
    if (!key.trim()) { setConnection('failed'); setError('Enter your Seedance API key.'); return; }
    setConnection('checking'); setError(null);
    try {
      await json<{ connected: true }>(await fetch('/api/config/verify', {
        method: 'POST',
        headers: { ...generationAuth(workspaceKey, key.trim()) }
      }));
      sessionStorage.setItem('jujitsu-seedance-api-key', key.trim());
      setApiKey(key.trim()); setConnection('connected');
    } catch (cause) {
      sessionStorage.removeItem('jujitsu-seedance-api-key');
      setConnection('failed');
      setError(cause instanceof Error ? cause.message : 'Connection verification failed');
    }
  }

  async function addVideo(file?: File) {
    if (!file) return; setError(null);
    if (!['video/mp4', 'video/quicktime'].includes(file.type)) return setError('Use an MP4 or MOV source video.');
    if (file.size > 200 * 1024 * 1024) return setError('Video must be 200 MB or smaller.');
    const draft: Asset = { id: crypto.randomUUID(), name: file.name, key: '', preview: URL.createObjectURL(file), progress: 0 };
    setVideo(draft); setUploading((value) => value + 1);
    try {
      const key = await upload(file, 'video', accessKey, (progress) => setVideo((item) => item?.id === draft.id ? { ...item, progress } : item));
      setVideo((item) => item?.id === draft.id ? { ...item, key, progress: 100 } : item);
    } catch (cause) { setVideo(null); setError(cause instanceof Error ? cause.message : 'Upload failed'); }
    finally { setUploading((value) => value - 1); }
  }
  async function addImages(files: FileList | null) {
    if (!files) return; setError(null);
    await Promise.all(Array.from(files).slice(0, 30 - images.length).map(async (file) => {
      if (!file.type.startsWith('image/') || file.size > 30 * 1024 * 1024) return setError(`${file.name} is not a supported image under 30 MB.`);
      const draft: Asset = { id: crypto.randomUUID(), name: file.name, key: '', preview: URL.createObjectURL(file), progress: 0 };
      setImages((all) => [...all, draft]); setUploading((value) => value + 1);
      try {
        const key = await upload(file, 'image', accessKey, (progress) => setImages((all) => all.map((item) => item.id === draft.id ? { ...item, progress } : item)));
        setImages((all) => all.map((item) => item.id === draft.id ? { ...item, key, progress: 100 } : item));
      } catch (cause) { setImages((all) => all.filter((item) => item.id !== draft.id)); setError(cause instanceof Error ? cause.message : 'Upload failed'); }
      finally { setUploading((value) => value - 1); }
    }));
  }
  async function generate() {
    setError(null);
    if (!config?.serverApiConfigured && connection !== 'connected') return setError('Save and verify your Seedance API key first.');
    if (config?.accessRequired && !accessKey) return setError('Enter the workspace access key.');
    if (!video?.key || !images.length || images.some((image) => !image.key)) return setError('Upload one video and at least one image.');
    if (!video.duration || video.duration < 4 || video.duration > 30) return setError('Video must be 4–30 seconds.');
    try {
      const data = await json<{ tasks: Array<{ id: string; status: string }> }>(await fetch('/api/generations', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...generationAuth(accessKey, apiKey) },
        body: JSON.stringify({ prompt, resolution: quality, batch, videoKey: video.key, imageKeys: images.map((image) => image.key) })
      }));
      setJobs((all) => [...data.tasks.map<Job>((task) => ({ id: task.id, createdAt: new Date().toISOString(), status: task.status === 'succeeded' ? 'succeeded' : 'queued', quality, prompt })), ...all]);
      setHistory(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Generation failed'); }
  }
  const estimate = useMemo(() => {
    if (!video?.duration) return null;
    const pixels = quality === '480p' ? 864 * 480 : quality === '720p' ? 1248 * 704 : 1920 * 1080;
    return video.duration * 2 * pixels * 24 / 1024 / 1_000_000 * (quality === '1080p' ? 7 : 6.4) * batch;
  }, [batch, quality, video?.duration]);
  const result = jobs.find((job) => job.status === 'succeeded' && job.videoUrl);
  const ready = Boolean((config?.serverApiConfigured || connection === 'connected') && (!config?.accessRequired || accessKey) && video?.key && video.duration && video.duration >= 4 && video.duration <= 30 && images.length && images.every((image) => image.key) && !uploading);

  return <main className='min-h-screen bg-background text-foreground'>
    <header className='sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl'><div className='mx-auto flex h-16 max-w-[1600px] items-center justify-between px-5 lg:px-8'>
      <button onClick={() => setHistory(false)} className='font-mono text-sm tracking-[.24em]'>JUJITSU</button>
      <div className='flex items-center gap-3'><span className='hidden font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground sm:block'>Seedance 2.5</span><button onClick={() => setHistory(!history)} className='border border-border bg-secondary px-3 py-2 text-xs hover:bg-accent'>{history ? 'New transfer' : `Jobs${jobs.length ? ` (${jobs.length})` : ''}`}</button></div>
    </div></header>
    {history ? <History jobs={jobs} setJobs={setJobs} /> : <div className='mx-auto grid max-w-[1600px] gap-px bg-border p-px lg:grid-cols-[460px_minmax(0,1fr)]'>
      <section className='bg-card p-5 sm:p-7'><p className='font-mono text-[10px] uppercase tracking-[.22em] text-muted-foreground'>Motion transfer</p><h1 className='mt-3 font-display text-4xl leading-none sm:text-5xl'>Replace the character.<br />Keep the performance.</h1><p className='mt-4 text-sm leading-6 text-muted-foreground'>Upload a 4–30 second source and up to 30 identity references. The files go to the official Seedance 2.5 motion-edit API.</p>
        <div className='mt-8 space-y-7 border-t border-border pt-7'>
          <Label step='01' title='Motion source' note='MP4 / MOV · 200 MB' /><input ref={videoInput} hidden type='file' accept='video/mp4,video/quicktime' onChange={(event) => void addVideo(event.target.files?.[0])} />
          {video ? <div className='relative overflow-hidden border border-border bg-background'>{/* oxlint-disable-next-line jsx-a11y/media-has-caption */}<video src={video.preview} className='h-48 w-full object-cover opacity-80' muted playsInline onLoadedMetadata={(event) => { const duration = event.currentTarget.duration; setVideo((item) => item ? { ...item, duration } : item); }} /><button onClick={() => insertReference('@Video 1')} className='absolute left-2 top-2 bg-black/80 px-2 py-1 font-mono text-[9px] text-white'>@Video 1</button><div className='absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black p-4 pt-16 text-white'><div className='min-w-0'><p className='truncate text-xs'>{video.name}</p><p className='mt-1 font-mono text-[9px] text-white/60'>{video.progress < 100 ? `${video.progress}%` : video.duration ? `${video.duration.toFixed(1)}s · ready` : 'reading'}</p></div><button aria-label='Remove video' onClick={() => setVideo(null)}><Icons.trash size={16} /></button></div></div> : <Drop title='Choose a motion video' hint='Timing, camera and performance to preserve' click={() => videoInput.current?.click()} drop={(files) => void addVideo(files[0])} />}
          <Label step='02' title='Visual references' note={`${images.length}/30`} /><input ref={imageInput} hidden multiple type='file' accept='image/*,.heic,.heif' onChange={(event) => void addImages(event.target.files)} /><div className='grid grid-cols-4 gap-2'>{images.map((image, index) => <div key={image.id} className='group relative aspect-square overflow-hidden border border-border'>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={image.preview} alt={`Reference ${index + 1}`} className='h-full w-full object-cover' /><button onClick={() => insertReference(`@Image ${index + 1}`)} className='absolute bottom-1 left-1 bg-black/80 px-1.5 py-1 font-mono text-[8px] text-white'>@Image {index + 1}</button><button aria-label={`Remove ${image.name}`} onClick={() => setImages((all) => all.filter((item) => item.id !== image.id))} className='absolute right-1 top-1 bg-black/75 p-1 text-white opacity-0 group-hover:opacity-100 focus:opacity-100'><Icons.close size={13} /></button></div>)}{images.length < 30 && <button aria-label='Add images' onClick={() => imageInput.current?.click()} className='grid aspect-square place-items-center border border-dashed border-border bg-secondary text-muted-foreground'><Icons.add size={20} /></button>}</div>
          <label className='block space-y-2 text-xs text-muted-foreground'>Prompt <span className='float-right font-mono text-[9px] uppercase'>Use @ references</span><div className='flex flex-wrap gap-1'>{video && <button type='button' onClick={() => insertReference('@Video 1')} className='border border-border bg-secondary px-2 py-1 font-mono text-[9px] text-foreground'>@Video 1</button>}{images.map((image, index) => <button type='button' key={image.id} onClick={() => insertReference(`@Image ${index + 1}`)} className='border border-border bg-secondary px-2 py-1 font-mono text-[9px] text-foreground'>@Image {index + 1}</button>)}</div><textarea ref={promptInput} value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={10000} placeholder='Replace the performer in @Video 1 with @Image 1. Use @Image 2 for the outfit…' className='min-h-28 w-full resize-none border border-border bg-input p-3 text-sm text-foreground' /></label>
          <div className='grid grid-cols-2 gap-3'><label className='space-y-2 text-xs text-muted-foreground'>Resolution<select value={quality} onChange={(event) => setQuality(event.target.value as Quality)} className='h-11 w-full border border-border bg-input px-3 text-sm text-foreground'><option value='480p'>480p · $6.40 / 1M</option><option value='720p'>720p · $6.40 / 1M</option><option value='1080p'>1080p · $7.00 / 1M</option></select></label><label className='space-y-2 text-xs text-muted-foreground'>Outputs<select value={batch} onChange={(event) => setBatch(Number(event.target.value))} className='h-11 w-full border border-border bg-input px-3 text-sm text-foreground'>{[1,2,3,4].map((value) => <option key={value}>{value}</option>)}</select></label></div>
          {config?.accessRequired && <label className='block space-y-2 text-xs text-muted-foreground'>Workspace access key<input type='password' value={accessKey} onChange={(event) => { setAccessKey(event.target.value); sessionStorage.setItem('jujitsu-access-key', event.target.value); }} className='h-11 w-full border border-border bg-input px-3 text-sm text-foreground' /></label>}
          <div className='space-y-2'><label className='block text-xs text-muted-foreground'>Seedance API key <span className='float-right font-mono text-[9px] uppercase'>{config?.serverApiConfigured ? 'Optional · server connected' : 'Required'}</span></label><div className='flex gap-2'><input type='password' value={apiKey} onChange={(event) => { setApiKey(event.target.value); setConnection('disconnected'); }} placeholder='Paste your BytePlus ModelArk API key' autoComplete='off' className='h-11 min-w-0 flex-1 border border-border bg-input px-3 text-sm text-foreground' /><button type='button' onClick={() => void verifyKey()} disabled={!apiKey || connection === 'checking'} className='h-11 shrink-0 border border-border bg-primary px-4 text-xs font-medium text-primary-foreground disabled:opacity-30'>{connection === 'checking' ? 'Checking…' : 'Save & verify'}</button></div><p className='text-[10px] leading-4 text-muted-foreground'>Saved only for this browser tab after BytePlus verifies it.</p></div>
          <div className='grid grid-cols-2 gap-px border border-border bg-border font-mono text-[9px] uppercase tracking-[.1em]'><div className='bg-background p-3'><p className='text-muted-foreground'>Connection</p><p className={`mt-1 flex items-center gap-1.5 ${connection === 'connected' || (!apiKey && config?.serverApiConfigured) ? 'text-emerald-300' : connection === 'failed' ? 'text-red-300' : ''}`}>{connection === 'checking' ? <Icons.spinner className='animate-spin' size={13} /> : connection === 'connected' || (!apiKey && config?.serverApiConfigured) ? <Icons.connected size={13} /> : <Icons.disconnected size={13} />}{connection === 'checking' ? 'Checking' : connection === 'connected' ? 'Connected' : !apiKey && config?.serverApiConfigured ? 'Server connected' : connection === 'failed' ? 'Connection failed' : 'Not connected'}</p></div><div className='bg-background p-3'><p className='text-muted-foreground'>List-rate estimate</p><p className='mt-1'>{estimate ? `~$${estimate.toFixed(2)}` : 'Needs video'}</p></div></div><p className='text-[11px] leading-5 text-muted-foreground'>Estimate assumes matching output duration at 24 fps. Completed jobs show token usage × official list rate. The generation API does not expose account balance.</p>
          {error && <div role='alert' className='flex gap-2 border border-destructive/40 bg-destructive/10 p-3 text-xs text-red-200'><Icons.warning size={15} />{error}</div>}
          <button disabled={!ready} onClick={() => void generate()} className='flex h-13 w-full items-center justify-center gap-2 bg-primary text-sm font-medium text-primary-foreground disabled:opacity-25'>{uploading ? <Icons.spinner className='animate-spin' size={17} /> : <Icons.sparkles size={17} />}{uploading ? `Uploading ${uploading}` : `Generate${estimate ? ` · ~$${estimate.toFixed(2)}` : ''}`}</button>
        </div></section>
      <section className='min-h-[760px] bg-background p-5 sm:p-8'><div className='flex justify-between border-b border-border pb-4 font-mono text-[9px] uppercase tracking-[.16em]'><span>Output</span><span className='text-muted-foreground'>Adaptive · audio on · no watermark</span></div>{result ? <div className='grid min-h-[680px] place-items-center py-8'><video src={result.videoUrl ?? undefined} controls playsInline className='max-h-[70vh] w-full bg-black object-contain' /></div> : <div className='grid min-h-[680px] place-items-center text-center'><div><p className='font-display text-5xl text-muted-foreground/35'>Ready when you are.</p><p className='mt-4 text-sm text-muted-foreground'>Only real Seedance output appears here.</p></div></div>}</section>
    </div>}
  </main>;
}

function Label({ step, title, note }: { step: string; title: string; note: string }) { return <div className='flex justify-between'><div className='flex gap-2'><span className='font-mono text-[9px] text-muted-foreground'>{step}</span><h2 className='text-xs'>{title}</h2></div><span className='font-mono text-[9px] uppercase text-muted-foreground'>{note}</span></div>; }
function Drop({ title, hint, click, drop }: { title: string; hint: string; click: () => void; drop: (files: FileList) => void }) { return <button onClick={click} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); drop(event.dataTransfer.files); }} className='flex w-full items-center gap-4 border border-dashed border-border bg-secondary p-5 text-left hover:bg-accent'><span className='grid size-10 place-items-center border border-border bg-background'><Icons.upload size={18} /></span><span><span className='block text-sm'>{title}</span><span className='mt-1 block text-xs text-muted-foreground'>{hint}</span></span></button>; }
function History({ jobs, setJobs }: { jobs: Job[]; setJobs: React.Dispatch<React.SetStateAction<Job[]>> }) { return <section className='mx-auto max-w-6xl px-5 py-12'><p className='font-mono text-[10px] uppercase tracking-[.22em] text-muted-foreground'>Real tasks · browser-local history</p><h1 className='mt-3 font-display text-5xl'>Seedance jobs</h1>{jobs.length ? <div className='mt-10 divide-y divide-border border-y border-border'>{jobs.map((job) => <article key={job.id} className='grid gap-4 py-5 sm:grid-cols-[1fr_auto]'><div className='min-w-0'><p className='font-mono text-[10px] uppercase'>{job.status} · {job.quality}</p><p className='mt-2 truncate text-sm text-muted-foreground'>{job.prompt || 'Default character replacement instruction'}</p><p className='mt-1 font-mono text-[9px] text-muted-foreground'>{job.id} · {new Date(job.createdAt).toLocaleString()}</p>{job.completionTokens && <p className='mt-2 text-xs text-muted-foreground'>{job.completionTokens.toLocaleString()} tokens{job.costUsd ? ` · $${job.costUsd.toFixed(4)} list-rate estimate` : ''}</p>}{job.error && <p className='mt-2 text-xs text-red-300'>{job.error}</p>}</div><div className='flex gap-2'>{job.videoUrl && <a href={job.videoUrl} target='_blank' rel='noreferrer' className='border border-border bg-secondary px-3 py-2 text-xs'>Open video</a>}<button aria-label={`Remove ${job.id}`} onClick={() => setJobs((all) => all.filter((item) => item.id !== job.id))} className='border border-border p-2'><Icons.trash size={15} /></button></div></article>)}</div> : <p className='mt-10 border-y border-border py-10 text-sm text-muted-foreground'>No tasks yet.</p>}</section>; }
