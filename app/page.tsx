import Link from 'next/link';
import { Upload } from 'lucide-react';
import FileRow from '@/components/FileRow';
import { Hero } from '@/components/ui/hero-1';
import { Button } from '@/components/ui/button';
import { loadContent } from '@/lib/content';
import { plural, REPO } from '@/lib/rules';

export default function Home() {
  const { catalog, items } = loadContent();
  const nameOf = (slug: string) => catalog.categories.find((c) => c.slug === slug)?.name;

  return (
    <>
      <Hero
        eyebrow="Incubation Center, NIT Patna"
        eyebrowHref={`https://github.com/${REPO}`}
        title="Every document, one place."
        subtitle="Policies, MoUs, reports, templates and event material from the Incubation Center. Anyone can browse and download. IC members sign in with their college email to add files."
      >
        <nav aria-label="Folders" className="mx-auto max-w-4xl">
          <ul className="grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
            {catalog.categories.map((c) => {
              const count = items.filter((i) => i.category === c.slug).length;
              return (
                <li key={c.slug}>
                  <Link href={`/${c.slug}`} className="flex h-full flex-col gap-1 rounded-xl border bg-background/80 p-4 backdrop-blur transition-colors hover:border-foreground/40">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold tracking-tight">{c.name}</span>
                      <span className="text-sm text-muted-foreground tabular-nums">{count || 'empty'}</span>
                    </span>
                    <span className="text-sm text-muted-foreground">{c.description}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Button asChild size="lg" className="mt-8 gap-2">
            <Link href="/upload">
              <Upload aria-hidden className="size-4" />
              Upload a document
            </Link>
          </Button>
          <p className="mt-4 text-sm tracking-tight text-gray-600 dark:text-gray-400">
            {items.length ? `${plural(items.length, 'document')} so far, added by the people who use them.` : 'Nothing is up yet. Be the first to add a file.'}
          </p>
        </nav>
      </Hero>

      {items.length > 0 && (
        <section aria-labelledby="recent-title" className="mx-auto max-w-6xl px-4 pt-16 pb-24 md:px-6">
          <h2 id="recent-title" className="text-gradient pb-1 text-4xl font-semibold tracking-tighter text-balance md:text-5xl">
            Recently added
          </h2>
          <ul className="mt-8 divide-y rounded-xl border bg-card">
            {items.slice(0, 8).map((i) => (
              <FileRow key={i.path} item={i} where={nameOf(i.category)} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
