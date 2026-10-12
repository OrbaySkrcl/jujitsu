// Best-effort per-instance request limits. Use a shared edge/Redis limiter for public production.
import { createHash } from 'node:crypto';

const windows = new Map<string, { count: number; reset: number }>();
export function takeQuota(request: Request, action: string, limit: number): boolean {
  const key = request.headers.get('x-access-key') || request.headers.get('x-seedance-api-key') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous';
  const id = action + ':' + createHash('sha256').update(key).digest('hex');
  const now = Date.now();
  if (windows.size > 10000) {
    for (const [entry, value] of windows) if (value.reset <= now) windows.delete(entry);
  }
  const current = windows.get(id);
  if (!current || current.reset <= now) {
    windows.set(id, { count: 1, reset: now + 3600000 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count++;
  return true;
}
