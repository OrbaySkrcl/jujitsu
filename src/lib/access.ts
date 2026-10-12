import { timingSafeEqual } from 'node:crypto';

export function accessRequired(): boolean {
  return Boolean(process.env.APP_ACCESS_KEY);
}

export function hasAccess(request: Request): boolean {
  const expected = process.env.APP_ACCESS_KEY;
  if (!expected) return true;
  const actual = request.headers.get('x-access-key') ?? '';
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
