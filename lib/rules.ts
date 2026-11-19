// Every content rule in one place. Pure TypeScript with no Node or browser APIs, so the upload
// page, the upload route, the build and the CI check all enforce exactly the same rules.

export const REPO = 'Harsh-Kapadiya/ICDMS';
export const BRANCH = 'main';
export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_FILES = 5; // per submission; each file is its own commit
export const MAX_TITLE = 120;
// Vercel caps every request body at 4.5 MB, so the browser sends a file in parts of this size
// and the server joins them before checking the whole file.
export const PART_BYTES = 3 * 1024 * 1024;
export const MAX_PARTS = Math.ceil(MAX_BYTES / PART_BYTES);

// Allowed extensions and the first bytes their files must start with.
// ponytail: Office files are all zip, so a renamed zip passes as .docx; fine, they are only ever downloaded
const ZIP = [0x50, 0x4b, 0x03, 0x04];
export const TYPES: Record<string, { label: string; magic: number[]; inline: boolean }> = {
  pdf: { label: 'PDF', magic: [0x25, 0x50, 0x44, 0x46, 0x2d], inline: true },
  docx: { label: 'Word', magic: ZIP, inline: false },
  pptx: { label: 'PowerPoint', magic: ZIP, inline: false },
  xlsx: { label: 'Excel', magic: ZIP, inline: false },
  png: { label: 'Image', magic: [0x89, 0x50, 0x4e, 0x47], inline: true },
  jpg: { label: 'Image', magic: [0xff, 0xd8, 0xff], inline: true },
  jpeg: { label: 'Image', magic: [0xff, 0xd8, 0xff], inline: true },
};
export const ACCEPT = Object.keys(TYPES).map((e) => `.${e}`).join(',');

export type Category = { slug: string; name: string; description: string };
export type Catalog = { categories: Category[] };
/** Sidecar saved next to every uploaded file as `<file>.json`, so the site can show who added it. */
export type Meta = { title: string; by: string; at: string };
export type Item = Meta & { category: string; file: string; ext: string; path: string; bytes: number };

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RESERVED = ['api', 'upload', 'content']; // top-level routes a category slug would collide with

export const isSlug = (s: string) => SLUG.test(s);
export const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');
export const extOf = (name: string) => name.toLowerCase().split('.').pop() ?? '';
/** "MoU with Acme (2026).PDF" -> "MoU with Acme (2026)" */
export const titleFromName = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
export const targetPath = (category: string, title: string, ext: string) => `Content/${category}/${slugify(title)}.${ext}`;
export const fmtSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace(/\.0$/, '')} MB`);
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const anchor = (i: Pick<Item, 'file'>) => `f-${i.file.replace(/\./g, '-')}`;
export const startsWith = (head: Uint8Array, magic: number[]) => magic.every((b, i) => head[i] === b);

/** Problem with an uploader's title, or '' when it is fine. */
export function checkTitle(title: string) {
  if (!title.trim()) return 'Give the file a title';
  if (title.length > MAX_TITLE) return `Keep the title under ${MAX_TITLE} characters`;
  if (slugify(title).length < 3) return 'The title needs at least 3 letters or digits';
  return '';
}

/** Check where a file would go, before looking at its bytes. Returns the problem, or the parsed path. */
export function checkPath(path: string, catalog: Catalog) {
  const parts = path.split('/');
  if (parts.length !== 3 || parts[0] !== 'Content') return 'Must be at Content/<category>/<file>';
  const [, category, file] = parts;
  if (!catalog.categories.some((c) => c.slug === category)) return `Unknown category "${category}"`;
  const ext = extOf(file);
  const type = Object.hasOwn(TYPES, ext) ? TYPES[ext] : undefined;
  if (!type) return `Only ${Object.keys(TYPES).join(', ')} files are allowed`;
  const stem = file.slice(0, -ext.length - 1);
  if (!isSlug(stem) || stem.length < 3 || stem.length > 80) return 'Name must be 3 to 80 lowercase letters, digits and hyphens';
  return { category, file, ext, stem, type };
}

/** Check one file at a repository path. Returns the item, or the first problem found. */
export function check(path: string, bytes: number, head: Uint8Array, catalog: Catalog): string | Item {
  const p = checkPath(path, catalog);
  if (typeof p === 'string') return p;
  if (!startsWith(head, p.type.magic)) return `This is not really a ${p.type.label} file`;
  if (bytes > MAX_BYTES) return `Larger than ${fmtSize(MAX_BYTES)}`;
  return { category: p.category, file: p.file, ext: p.ext, path, bytes, title: titleFromName(p.stem).replace(/^./, (c) => c.toUpperCase()), by: '', at: '' };
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** Is this email on the IC members list? Case and surrounding spaces don't matter. */
export const isMember = (email: string | null | undefined, members: string[]) =>
  !!email && members.some((m) => m.trim().toLowerCase() === email.trim().toLowerCase());

/** Problems in members.json; an empty list means it is valid. */
export function checkMembers(m: { emails?: unknown }): string[] {
  if (!Array.isArray(m?.emails)) return ['members.json needs an "emails" list'];
  return m.emails.flatMap((e) => (typeof e === 'string' && EMAIL.test(e.trim()) ? [] : [`Not an email address: ${JSON.stringify(e)}`]));
}

/** Merge a sidecar into an item. Files committed by hand have none, or a broken one; they keep their defaults. */
export function withMeta(item: Item, raw: unknown): Item {
  const m = (raw ?? {}) as Partial<Record<keyof Meta, unknown>>;
  const str = (v: unknown) => (typeof v === 'string' ? v.slice(0, MAX_TITLE) : '');
  return { ...item, title: str(m.title) || item.title, by: str(m.by), at: str(m.at) };
}

/** Problems in catalog.json; an empty list means it is valid. */
export function checkCatalog(c: Catalog): string[] {
  if (!Array.isArray(c?.categories)) return ['catalog.json needs a "categories" list'];
  const seen = new Set<string>();
  const errors = c.categories.flatMap((x) => {
    const bad = !isSlug(x.slug) || RESERVED.includes(x.slug) || !x.name || typeof x.description !== 'string' || seen.has(x.slug);
    seen.add(x.slug);
    return bad ? [`Bad category ${JSON.stringify(x)}`] : [];
  });
  return errors;
}

/** Newest upload first; files without a date (committed by hand) last, by title. */
export const byNewest = (a: Item, b: Item) => b.at.localeCompare(a.at) || a.title.localeCompare(b.title);
