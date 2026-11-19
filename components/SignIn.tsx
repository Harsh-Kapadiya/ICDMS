'use client';
import { useState } from 'react';
import { CircleAlert, LoaderCircle, Mail, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { checkName, isEmail } from '@/lib/rules';

const field =
  'h-11 rounded-md border border-input bg-background px-3 text-base text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 md:h-10 md:text-sm';
const label = 'flex flex-col gap-1.5 text-sm font-medium tracking-tight';

/** Ask for a sign-in link. The server answers the same whether or not the email is on the list. */
export default function SignIn() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = checkName(name) || (isEmail(email) ? '' : 'Enter a valid email address');
    if (problem) return setError(problem);
    setError('');
    setState('sending');
    try {
      const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Something went wrong (${res.status})`);
      setState('sent');
    } catch (err) {
      setError(err instanceof TypeError ? 'Network error. Check your connection and try again.' : (err as Error).message);
      setState('idle');
    }
  };

  if (state === 'sent')
    return (
      <div className="mt-8 max-w-xl rounded-xl border bg-card p-5" role="status">
        <p className="flex items-center gap-2 font-semibold tracking-tight">
          <MailCheck aria-hidden className="size-5" />
          Check your inbox
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          If {email.trim()} is on the IC members list, a sign-in link is on its way. It works for 15 minutes. Look in spam if you don&apos;t see it.
        </p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => setState('idle')}>
          Use a different email
        </Button>
      </div>
    );

  return (
    <form onSubmit={submit} noValidate className="mt-8 flex max-w-xl flex-col gap-4 rounded-xl border bg-card p-5">
      <label className={label}>
        Your name
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} disabled={state === 'sending'} />
        <span className="font-normal text-muted-foreground">Shown next to the files you add.</span>
      </label>
      <label className={label}>
        Official college email
        <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="name@nitp.ac.in" disabled={state === 'sending'} />
      </label>
      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="gap-2 self-start" disabled={state === 'sending'}>
        {state === 'sending' ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Mail aria-hidden className="size-4" />}
        Email me a sign-in link
      </Button>
    </form>
  );
}
