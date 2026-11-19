import { sendLoginLink } from '@/lib/mail';
import { isMember } from '@/lib/members';
import { checkName, isEmail } from '@/lib/rules';
import { LOGIN_SECONDS, sign } from '@/lib/session';

/** Step 1 of signing in: email a one-time link, but only to addresses on .members. */
export async function POST(req: Request) {
  const { email, name } = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const nameProblem = typeof name === 'string' ? checkName(name) : checkName('');
  if (nameProblem) return Response.json({ error: nameProblem }, { status: 400 });
  if (typeof email !== 'string' || !isEmail(email)) return Response.json({ error: 'Enter a valid email address' }, { status: 400 });

  if (isMember(email)) {
    try {
      // Links point at SITE_URL, never at the request's Host header, which a client can forge
      const site = process.env.SITE_URL || (process.env.NODE_ENV === 'production' ? undefined : new URL(req.url).origin);
      if (!site) throw new Error('SITE_URL is not set, so sign-in links have nowhere to point');
      const token = sign({ email: email.trim().toLowerCase(), name: (name as string).trim(), use: 'login' }, LOGIN_SECONDS);
      await sendLoginLink(email.trim(), `${site.replace(/\/+$/, '')}/api/login/verify?token=${token}`);
    } catch (e) {
      console.error(e);
      return Response.json({ error: "Couldn't send the email. Try again in a minute." }, { status: 502 });
    }
  }
  // The same reply whether or not the email is on the list, so this form can't be used to read the hidden list
  // ponytail: no rate limit, so anyone can make a member's inbox receive links; add one (e.g. Vercel firewall rule) if abused
  return Response.json({ ok: true });
}
