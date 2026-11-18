import type { NextAuthOptions } from 'next-auth';
import Google from 'next-auth/providers/google';

// There are no admins: anyone with a Google account can sign in and upload. Sign-in exists only so
// every upload carries a real name, and so bots cannot fill the form.
// ponytail: anyone with Google; to limit uploads to institute accounts, add a signIn callback checking the email domain
export const authOptions: NextAuthOptions = {
  providers: [Google({ clientId: process.env.GOOGLE_ID ?? '', clientSecret: process.env.GOOGLE_SECRET ?? '' })],
};
