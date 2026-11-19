import { getServerSession, type NextAuthOptions } from 'next-auth';
import Google from 'next-auth/providers/google';
import members from '@/members.json';
import { isMember } from './rules.ts';

export const DENIED = 'Only IC members can upload. Sign in with your official college email.';

// Only IC members can upload: their official college emails are listed in members.json.
// Checked twice: at sign-in, so anyone else is turned away at the door, and on every upload request,
// so someone removed from the list loses access at the next deploy even if they are still signed in.
export const authOptions: NextAuthOptions = {
  providers: [Google({ clientId: process.env.GOOGLE_ID ?? '', clientSecret: process.env.GOOGLE_SECRET ?? '' })],
  pages: { error: '/upload' }, // a refused sign-in lands on /upload?error=AccessDenied
  callbacks: {
    signIn: ({ profile }) => (profile as { email_verified?: boolean } | undefined)?.email_verified === true && isMember(profile?.email, members.emails),
  },
};

/** The signed-in IC member's name, or null when nobody is signed in or the account isn't on the list. */
export async function memberName() {
  const user = (await getServerSession(authOptions))?.user;
  return user?.email && isMember(user.email, members.emails) ? user.name || user.email : null;
}
