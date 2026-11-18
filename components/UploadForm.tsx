'use client';
import { useState } from 'react';
import { CircleAlert, CircleCheck, LoaderCircle, Upload as UploadIcon, X } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ACCEPT, check, checkTitle, extOf, fmtSize, MAX_BYTES, MAX_FILES, MAX_TITLE, plural, targetPath, titleFromName, type Category } from '@/lib/rules';

type Row = { file: File; head: Uint8Array; title: string; state: 'ready' | 'sending' | 'done' | 'failed'; message?: string; url?: string; path?: string };

// shadcn-style form controls in the site theme
const field =
  'h-11 rounded-md border border-input bg-background px-3 text-base text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 md:h-10 md:text-sm';
const label = 'flex flex-col gap-1.5 text-sm font-medium tracking-tight';
const note = 'mt-2 flex items-start gap-2 text-sm [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0';

/**
 * The browser checks every file against the same rules as the server, so problems show before
 * anything is sent. Files then go one by one; each becomes its own commit.
 * ponytail: one commit per file keeps every request under Vercel's 4.5 MB cap; batch commits need signed blob handoffs
 */
export default function UploadForm({ categories, initial }: { categories: Category[]; initial: string }) {
  const [category, setCategory] = useState(initial);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  const add = async (list: FileList | null) => {
    const added = await Promise.all(
      [...(list ?? [])].map(async (file): Promise<Row> => ({ file, head: new Uint8Array(await file.slice(0, 5).arrayBuffer()), title: titleFromName(file.name), state: 'ready' })),
    );
    setRows((r) => [...r.filter((x) => x.state !== 'done'), ...added]);
    setInputKey((k) => k + 1);
  };
  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const paths = rows.map((r) => targetPath(category, r.title, extOf(r.file.name)));
  const problems = rows.map((r, i) => {
    if (r.state === 'done') return '';
    const result = checkTitle(r.title) || check(paths[i], r.file.size, r.head, { categories });
    if (typeof result === 'string' && result) return result;
    if (paths.findIndex((p, j) => p === paths[i] && rows[j].state !== 'done') !== i) return 'Same title as another file in this upload';
    return '';
  });
  const waiting = rows.filter((r) => r.state !== 'done').length;
  const ready = !busy && waiting > 0 && waiting <= MAX_FILES && problems.every((p) => !p);

  const upload = async () => {
    setBusy(true);
    for (const [i, r] of rows.entries()) {
      if (r.state === 'done') continue;
      update(i, { state: 'sending', message: undefined });
      const body = new FormData();
      body.set('file', r.file);
      body.set('title', r.title.trim());
      body.set('category', category);
      try {
        const res = await fetch('/api/upload', { method: 'POST', body });
        const json = await res.json().catch(() => ({}));
        update(i, res.ok ? { state: 'done', url: json.url, path: json.path } : { state: 'failed', message: json.error ?? `Upload failed (${res.status})` });
      } catch {
        update(i, { state: 'failed', message: 'Network error. Check your connection and try again.' });
      }
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
      <section aria-labelledby="upload-title" className="rounded-xl border bg-card p-5 md:p-6">
        <h2 id="upload-title" className="mb-5 text-xl font-semibold tracking-tighter md:text-2xl">
          Add files
        </h2>
        <div className="flex flex-wrap items-end gap-4">
          <label className={label}>
            Folder
            <select className={field} value={category} disabled={busy} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            PDF, Word, PowerPoint, Excel or images, up to {fmtSize(MAX_BYTES)} each
            <input
              key={inputKey}
              type="file"
              accept={ACCEPT}
              multiple
              disabled={busy}
              className={cn(field, 'py-2 file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:text-sm file:text-foreground')}
              onChange={(e) => add(e.target.files)}
            />
          </label>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{categories.find((c) => c.slug === category)?.description}</p>

        {rows.length > 0 && (
          <ul className="mt-6 divide-y rounded-lg border">
            {rows.map((r, i) => (
              <li key={i} className="p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <p className="mr-auto basis-full font-medium sm:basis-auto">
                    {r.file.name} <span className="text-sm font-normal text-muted-foreground">{fmtSize(r.file.size)}</span>
                  </p>
                  {r.state !== 'done' && (
                    <label className={cn(label, 'min-w-60 flex-1 sm:flex-none')}>
                      Title
                      <input className={field} value={r.title} maxLength={MAX_TITLE} disabled={busy} onChange={(e) => update(i, { title: e.target.value, state: 'ready' })} />
                    </label>
                  )}
                  {r.state !== 'done' && !busy && (
                    <button type="button" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-11 gap-1.5 md:h-10')} onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>
                      <X aria-hidden className="size-4" />
                      Remove
                    </button>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Saved as <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{r.path ?? paths[i]}</code>
                </p>
                <div aria-live="polite">
                  {problems[i] && (
                    <p className={cn(note, 'text-destructive')}>
                      <CircleAlert aria-hidden />
                      {problems[i]}
                    </p>
                  )}
                  {r.state === 'sending' && (
                    <p className={cn(note, 'text-muted-foreground')}>
                      <LoaderCircle aria-hidden className="animate-spin" />
                      Uploading…
                    </p>
                  )}
                  {r.state === 'done' && (
                    <p className={note}>
                      <CircleCheck aria-hidden />
                      <span>
                        Uploaded. It shows on the site in a few minutes.{' '}
                        <a href={r.url} target="_blank" rel="noopener" className="font-medium underline underline-offset-4">
                          See the commit
                        </a>
                      </span>
                    </p>
                  )}
                  {r.state === 'failed' && (
                    <p role="alert" className={cn(note, 'text-destructive')}>
                      <CircleAlert aria-hidden />
                      {r.message}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {waiting > MAX_FILES && <p className={cn(note, 'text-destructive')}>Upload at most {MAX_FILES} files at a time.</p>}
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button type="button" disabled={!ready} onClick={upload} className={cn(buttonVariants(), 'h-11 gap-2 px-5 md:h-10')}>
            {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <UploadIcon aria-hidden className="size-4" />}
            {busy ? 'Uploading…' : waiting ? `Upload ${plural(waiting, 'file')}` : 'Upload'}
          </button>
          <p className="text-sm text-muted-foreground">Files can't be replaced or deleted from the site, so check the folder and title first.</p>
        </div>
      </section>
    </div>
  );
}
