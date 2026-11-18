// Self-check of the content rules and the upload route, then validation of everything in Content/.
// Run with: npm run check   (Node 22.18+ runs TypeScript directly, no install needed)
import assert from 'node:assert/strict';
import { loadContent } from '../lib/content.ts';
import { handleUpload } from '../lib/upload.ts';
import { byNewest, check, checkCatalog, slugify, targetPath, titleFromName, withMeta, type Catalog, type Item } from '../lib/rules.ts';

const catalog: Catalog = { categories: [{ slug: 'reports', name: 'Reports', description: '' }] };
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];
const ZIP = [0x50, 0x4b, 0x03, 0x04, 0x14];
const ok = (path: string, head = PDF, bytes = 1000) => typeof check(path, bytes, new Uint8Array(head), catalog) !== 'string';

assert(ok('Content/reports/annual-report-2026.pdf'));
assert(ok('Content/reports/pitch-deck.pptx', ZIP));
assert(ok('Content/reports/poster.jpg', [0xff, 0xd8, 0xff, 0xe0, 0]));
assert(!ok('Content/reports/annual-report.pdf', ZIP), 'a Word file renamed to .pdf');
assert(!ok('Content/reports/page.html'), 'html is not allowed');
assert(!ok('Content/reports/logo.svg'), 'svg can carry scripts');
assert(!ok('Content/finance/annual-report.pdf'), 'unknown category');
assert(!ok('Content/reports/../x.pdf'), 'path escape');
assert(!ok('Content/reports/a/b.pdf'), 'no subfolders');
assert(!ok('Content/reports/Annual Report.pdf'), 'spaces and capitals');
assert(!ok('Content/reports/big-file.pdf', PDF, 4 * 1024 * 1024 + 1), 'over 4 MB');
assert(!ok('Content/reports/toString.pdf'), 'capitals');
assert.equal(slugify('MoU with Acme Pvt. Ltd. (2026)'), 'mou-with-acme-pvt-ltd-2026');
assert.equal(titleFromName('MoU_with-Acme.PDF'), 'MoU with Acme');
assert.equal(targetPath('reports', 'Q3 Report!', 'pdf'), 'Content/reports/q3-report.pdf');
assert.deepEqual(checkCatalog({ categories: [{ slug: 'upload', name: 'x', description: '' }] }).length, 1, 'reserved slug');
const base = check('Content/reports/q3-report.pdf', 10, new Uint8Array(PDF), catalog) as Item;
assert.equal(withMeta(base, null).title, 'Q3 report', 'no sidecar: title from the file name');
assert.equal(withMeta(base, { title: 'Q3 Report', by: 'Asha', at: '2026-11-18T00:00:00Z' }).by, 'Asha');
assert.equal(withMeta(base, { title: 42, by: ['x'] }).title, 'Q3 report', 'a broken sidecar is ignored');
assert.deepEqual(
  [withMeta(base, { at: '2026-01-01' }), withMeta(base, {}), withMeta(base, { at: '2026-06-01' })].sort(byNewest).map((i) => i.at),
  ['2026-06-01', '2026-01-01', ''],
);

// The upload route against a fake GitHub: one commit, never an overwrite, retry when main moves.
let calls: string[] = [];
let taken = false;
let moves = 0;
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  const call = `${init?.method ?? 'GET'} ${String(url).replace(/^.*\/repos\/[^/]+\/[^/]+/, '').replace(/\?.*/, '')}`;
  calls.push(call);
  if (call.startsWith('GET /contents/')) return taken ? Response.json({}) : new Response('{}', { status: 404 });
  if (call.startsWith('PATCH') && moves-- > 0) return new Response('{"message":"Update is not a fast forward"}', { status: 422 });
  return Response.json({ object: { sha: 'head' }, tree: { sha: 'base' }, sha: 'new', html_url: 'https://github.com/c/new' });
}) as typeof fetch;

const form = (title: string, name: string, bytes = PDF, category = 'reports') => {
  const f = new FormData();
  f.set('file', new File([new Uint8Array(bytes)], name));
  f.set('title', title);
  f.set('category', category);
  return f;
};
const upload = (f: FormData) => handleUpload(f, 'Asha', catalog, new Date('2026-11-18T10:00:00Z'));

let r = await upload(form('Q3 Report', 'anything.pdf'));
assert.equal(r.status, 201);
assert.equal(r.body.path, 'Content/reports/q3-report.pdf');
assert.deepEqual(calls, ['POST /git/blobs', 'POST /git/blobs', 'GET /git/ref/heads/main', 'GET /contents/Content/reports/q3-report.pdf', 'GET /git/commits/head', 'POST /git/trees', 'POST /git/commits', 'PATCH /git/refs/heads/main']);

calls = [];
moves = 1;
assert.equal((await upload(form('Q3 Report', 'a.pdf'))).status, 201, 'retries when another upload lands first');
assert.equal(calls.filter((c) => c.startsWith('PATCH')).length, 2);

calls = [];
taken = true;
assert.equal((await upload(form('Q3 Report', 'a.pdf'))).status, 409, 'never overwrites');
assert(!calls.some((c) => c.startsWith('PATCH')), 'a refused upload must not move main');
taken = false;

calls = [];
assert.equal((await upload(form('Q3 Report', 'a.pdf', ZIP))).status, 400, 'checks the bytes, not just the name');
assert.equal((await upload(form('Q3 Report', 'a.pdf', PDF, 'finance'))).status, 400);
assert.equal((await upload(form('  ', 'a.pdf'))).status, 400);
assert.equal(calls.length, 0, 'invalid uploads never reach GitHub');

const { items, problems } = loadContent();
if (problems.length) process.exit(1); // loadContent already printed them
console.log(`Rules OK. ${items.length} files in Content/ are valid.`);
