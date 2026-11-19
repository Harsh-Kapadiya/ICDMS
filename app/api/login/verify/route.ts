import { NextResponse } from 'next/server';
import { isMember } from '@/lib/members';
import { COOKIE, SESSION_SECONDS, sign, verify } from '@/lib/session';

/** Step 2 of signing in: the emailed link lands here, and a valid one becomes a 30-day sign-in cookie. */
export function GET(req: Request) {
  const url = new URL(req.url);
  const p = verify(url.searchParams.get('token'), 'login');
  if (!p || !isMember(p.email)) return NextResponse.redirect(new URL('/upload?error=link', url), 303);
  const res = NextResponse.redirect(new URL('/upload', url), 303);
  res.cookies.set(COOKIE, sign({ email: p.email, name: p.name, use: 'session' }, SESSION_SECONDS), {
    httpOnly: true, // page scripts can't read it
    secure: url.protocol === 'https:',
    sameSite: 'lax', // not sent on other sites' form posts, so they can't upload as a member
    path: '/',
    maxAge: SESSION_SECONDS,
  });
  return res;
}
