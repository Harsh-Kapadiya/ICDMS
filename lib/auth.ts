import { cookies } from 'next/headers';
import { isMember } from './members.ts';
import { COOKIE, verify } from './session.ts';

export const DENIED = 'Only IC members can upload. Sign in with your official college email.';

/** Whoever the sign-in cookie says is signed in, member or not; null when nobody is. */
export async function getSession() {
  return verify((await cookies()).get(COOKIE)?.value, 'session');
}

/**
 * The signed-in IC member, or null. Membership is checked again on every request, so someone
 * removed from .members loses access at the next deploy even though their cookie lasts 30 days.
 */
export async function getMember() {
  const s = await getSession();
  return s && isMember(s.email) ? s : null;
}
