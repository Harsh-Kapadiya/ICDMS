import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Upload } from 'lucide-react';
import FileRow from '@/components/FileRow';
import PageHeader from '@/components/PageHeader';
import ShareButton from '@/components/ShareButton';
import { Button, buttonVariants } from '@/components/ui/button';
import { loadContent } from '@/lib/content';
import { plural } from '@/lib/rules';
import { cn } from '@/lib/utils';

type Params = { params: Promise<{ category: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => loadContent().catalog.categories.map((c) => ({ category: c.slug }));

async function find({ params }: Params) {
  const { category } = await params;
  const { catalog, items } = loadContent();
  const c = catalog.categories.find((x) => x.slug === category);
  if (!c) notFound();
  return { c, mine: items.filter((i) => i.category === category) };
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { c, mine } = await find(props);
  const description = mine.length ? `${plural(mine.length, 'document')} in ${c.name}. Free to view and download.` : `Nothing in ${c.name} yet.`;
  return { title: c.name, description, openGraph: { title: `${c.name}: Incubation Center documents`, description } };
}

export default async function CategoryPage(props: Params) {
  const { c, mine } = await find(props);
  const upload = `/upload?category=${c.slug}`;
  return (
    <>
      <PageHeader trail={[[`/${c.slug}`, c.name]]} title={c.name} meta={`${c.description} ${mine.length ? `${plural(mine.length, 'document')}, newest first.` : ''}`}>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild size="sm" className="h-11 gap-1.5 rounded-full md:h-9">
            <Link href={upload}>
              <Upload aria-hidden className="size-4" />
              Add a file here
            </Link>
          </Button>
          {mine.length > 0 && (
            <ShareButton className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-11 gap-1.5 rounded-full md:h-9 [&_svg]:size-4')} path={`/${c.slug}`} title={c.name} label="Share this folder" />
          )}
        </div>
      </PageHeader>

      <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        {mine.length ? (
          <ul className="divide-y rounded-xl border bg-card">
            {mine.map((i) => (
              <FileRow key={i.file} item={i} />
            ))}
          </ul>
        ) : (
          <div className="max-w-2xl rounded-2xl border border-dashed p-6 md:p-8">
            <h2 className="text-gradient pb-1 text-3xl font-semibold tracking-tighter">Empty so far.</h2>
            <p className="mt-2 text-muted-foreground">Nobody has added anything to {c.name} yet. If you have a file that belongs here, add it.</p>
            <Button asChild className="mt-6 gap-2">
              <Link href={upload}>
                <Upload aria-hidden className="size-4" />
                Add the first file
              </Link>
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
