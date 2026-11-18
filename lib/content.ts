import fs from 'node:fs';
import { byNewest, check, checkCatalog, withMeta, type Catalog, type Item } from './rules.ts';

let memo: { catalog: Catalog; items: Item[]; problems: string[] } | undefined;

/**
 * Reads Content/ at build time. An invalid catalog fails the build; an invalid file is left off
 * the site and reported, so one bad manual commit cannot take the site down.
 */
export function loadContent() {
  if (memo && process.env.NODE_ENV === 'production') return memo;
  const catalog: Catalog = JSON.parse(fs.readFileSync('Content/catalog.json', 'utf8'));
  const errors = checkCatalog(catalog);
  if (errors.length) throw new Error(`Content/catalog.json is invalid:\n${errors.join('\n')}`);

  const items: Item[] = [];
  const problems: string[] = [];
  const head = new Uint8Array(5);
  for (const rel of fs.readdirSync('Content', { recursive: true }) as string[]) {
    const path = `Content/${rel.replaceAll('\\', '/')}`;
    const stat = fs.statSync(path);
    if (stat.isDirectory() || path.endsWith('.json') || path.endsWith('/.gitkeep')) continue; // catalog and sidecars
    head.fill(0);
    const fd = fs.openSync(path, 'r');
    fs.readSync(fd, head, 0, 5, 0);
    fs.closeSync(fd);
    const result = check(path, stat.size, head, catalog);
    if (typeof result === 'string') {
      problems.push(`${path}: ${result}`);
      continue;
    }
    let meta: unknown;
    try {
      meta = JSON.parse(fs.readFileSync(`${path}.json`, 'utf8'));
    } catch {
      // no sidecar: committed by hand
    }
    items.push(withMeta(result, meta));
  }
  items.sort(byNewest);
  if (problems.length) console.warn(`Left off the site:\n${problems.join('\n')}`);
  return (memo = { catalog, items, problems });
}
