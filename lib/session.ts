import { createHmac, timingSafeEqual } from 'node:crypto';

// Signed tokens with no database: the payload is readable, but only the server, which holds
// AUTH_SECRET, can make a signature that matches it. Used twice, never interchangeably:
// "login" tokens go in the emailed link, "session" tokens in the sign-in cookie.

export type Use = 'login' | 'session';
export type Payload = { email: string; name: string; use: Use; exp: number };

export const COOKIE = 'icdms_session';
export const LOGIN_SECONDS = 15 * 60;
export const SESSION_SECONDS = 30 * 24 * 60 * 60;

function mac(data: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) throw new Error('AUTH_SECRET must be set to a long random string');
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export function sign(p: Omit<Payload, 'exp'>, seconds: number, now = Date.now()) {
  const data = Buffer.from(JSON.stringify({ ...p, exp: Math.floor(now / 1000) + seconds })).toString('base64url');
  return `${data}.${mac(data)}`;
}

/** The payload when the token is genuine, unexpired and meant for `use`; otherwise null. */
export function verify(token: string | null | undefined, use: Use, now = Date.now()): Payload | null {
  const [data, sig, extra] = (token ?? '').split('.');
  if (!data || !sig || extra !== undefined) return null;
  const want = Buffer.from(mac(data));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const p = JSON.parse(Buffer.from(data, 'base64url').toString()) as Payload;
    return p.use === use && typeof p.email === 'string' && typeof p.name === 'string' && p.exp * 1000 > now ? p : null;
  } catch {
    return null;
  }
}
