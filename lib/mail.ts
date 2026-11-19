import nodemailer from 'nodemailer';
import { LOGIN_SECONDS } from './session.ts';

/**
 * Email a sign-in link. Uses any SMTP account; for Gmail, an app password (docs/email-sign-in.md).
 * Locally, with no SMTP_HOST set, the link is printed in the terminal instead of being sent.
 */
export async function sendLoginLink(to: string, link: string) {
  const { SMTP_HOST, SMTP_PORT = '465', SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST) {
    if (process.env.NODE_ENV === 'production') throw new Error('SMTP_HOST is not set, so sign-in links cannot be emailed');
    console.log(`\nSign-in link for ${to} (email isn't set up, so it is printed here instead):\n${link}\n`);
    return;
  }
  const port = Number(SMTP_PORT);
  const minutes = LOGIN_SECONDS / 60;
  await nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } }).sendMail({
    from: `ICDMS <${SMTP_USER}>`,
    to,
    subject: 'Your ICDMS sign-in link',
    text: `Sign in to ICDMS, the Incubation Center document system:\n\n${link}\n\nThis link works for ${minutes} minutes. If you didn't ask for it, ignore this email.`,
    html: `<p>Sign in to ICDMS, the Incubation Center document system:</p><p><a href="${link}">Sign in to ICDMS</a></p><p style="color:#666">This link works for ${minutes} minutes. If you didn't ask for it, ignore this email.</p>`,
  });
}
