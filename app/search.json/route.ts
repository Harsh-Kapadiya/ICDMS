import { loadContent } from '@/lib/content';
import { anchor, TYPES } from '@/lib/rules';

// Built once at build time; the search box fetches it only when first opened.
export const dynamic = 'force-static';

export function GET() {
  const { catalog, items } = loadContent();
  const folders = catalog.categories.map((c) => ({
    label: c.name,
    where: 'Folder',
    href: `/${c.slug}`,
    key: `${c.name} ${c.slug} ${c.description}`.toLowerCase(),
  }));
  const files = items.map((i) => {
    const c = catalog.categories.find((x) => x.slug === i.category)!;
    return {
      label: i.title,
      where: [c.name, i.by && `added by ${i.by}`].filter(Boolean).join(', '),
      href: `/${i.category}#${anchor(i)}`,
      key: `${i.title} ${i.file} ${c.name} ${c.slug} ${TYPES[i.ext].label} ${i.ext} ${i.by} ${i.at.slice(0, 4)}`.toLowerCase(),
    };
  });
  return Response.json([...folders, ...files]);
}
