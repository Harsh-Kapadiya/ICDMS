// Self-check of the content rules, the members list, sign-in tokens and the upload routes, then validation of Content/ and .members.
// Run with: npm run check   (Node 22.18+ runs TypeScript directly, no install needed)
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadContent } from '../lib/content.ts';
import { memberHash, MEMBERS_FILE } from '../lib/members.ts';
import { sign, verify } from '../lib/session.ts';
import { handlePart, handleUpload } from '../lib/upload.ts';
import { byNewest, check, checkCatalog, checkName, isEmail, PART_BYTES, parseMembers, slugify, targetPath, titleFromName, withMeta, type Catalog, type Item } from '../lib/rules.ts';

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
assert(ok('Content/reports/big-file.pdf', PDF, 10 * 1024 * 1024), 'exactly 10 MB');
assert(!ok('Content/reports/big-file.pdf', PDF, 10 * 1024 * 1024 + 1), 'over 10 MB');
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

// Members list: hashed, case and spaces don't matter, the file holds no readable email.
const h = memberHash('Harsh.K@nitp.ac.in ');
assert.equal(h, memberHash('harsh.k@NITP.ac.in'));
assert.notEqual(h, memberHash('harsh.k@gmail.com'));
assert.match(h, /^[0-9a-f]{64}$/);
assert.notEqual(h, createHash('sha256').update('harsh.k@nitp.ac.in').digest('hex'), 'prefixed, so plain email-hash lists do not match');
const parsed = parseMembers(`# comment\n\n${h}\r\n${h}\nharsh.k@nitp.ac.in\n`);
assert.deepEqual(parsed.hashes, [h]);
assert.equal(parsed.problems.length, 2, 'a duplicate, and a plain email pasted in by mistake');
assert(isEmail('a.b@nitp.ac.in') && !isEmail('a b@nitp.ac.in') && !isEmail('nitp.ac.in'));
assert(!checkName('Asha Kumari') && checkName(' a ') && checkName('x'.repeat(61)));

// Sign-in tokens: only the server can make them, they expire, and a link token is not a session.
process.env.AUTH_SECRET = 'test-secret-that-is-long-enough';
const t = sign({ email: 'a@nitp.ac.in', name: 'Asha', use: 'login' }, 900, 1_000_000);
assert.equal(verify(t, 'login', 1_000_000)?.email, 'a@nitp.ac.in');
assert.equal(verify(t, 'session', 1_000_000), null, 'a login link is not a session');
assert.equal(verify(t, 'login', 1_000_000 + 901_000), null, 'expired after 15 minutes');
const [data, sig] = t.split('.');
const forged = Buffer.from(JSON.stringify({ email: 'boss@nitp.ac.in', name: 'X', use: 'login', exp: 9e9 })).toString('base64url');
assert.equal(verify(`${forged}.${sig}`, 'login', 1_000_000), null, 'changing the payload breaks the signature');
assert.equal(verify(`${data}.${sig.slice(0, -2)}xx`, 'login', 1_000_000), null);
for (const junk of [undefined, null, '', 'abc', 'a.b.c', `${data}.`]) assert.equal(verify(junk, 'login'), null);
process.env.AUTH_SECRET = 'a-different-secret-entirely-xyz';
assert.equal(verify(t, 'login', 1_000_000), null, 'another secret, another signature');

// The upload routes against a fake GitHub that keeps blobs: parts joined in order, one commit,
// never an overwrite, retry when main moves.
const MB = 1024 * 1024;
const blobs = new Map<string, string>(); // sha -> base64
let calls: string[] = [];
let taken = false;
let moves = 0;
let lastTree: { path: string; sha: string }[] = [];
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  const call = `${init?.method ?? 'GET'} ${String(url).replace(/^.*\/repos\/[^/]+\/[^/]+/, '').replace(/\?.*/, '')}`;
  calls.push(call);
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  if (call === 'POST /git/blobs') {
    const content = body.encoding === 'base64' ? body.content : Buffer.from(body.content).toString('base64');
    const sha = createHash('sha1').update(content).digest('hex');
    blobs.set(sha, content);
    return Response.json({ sha });
  }
  if (call.startsWith('GET /git/blobs/')) {
    const content = blobs.get(call.slice('GET /git/blobs/'.length));
    return content ? Response.json({ content, encoding: 'base64' }) : new Response('{}', { status: 404 });
  }
  if (call.startsWith('GET /contents/')) return taken ? Response.json({}) : new Response('{}', { status: 404 });
  if (call.startsWith('PATCH') && moves-- > 0) return new Response('{"message":"Update is not a fast forward"}', { status: 422 });
  if (call === 'POST /git/trees') lastTree = body.tree;
  return Response.json({ object: { sha: 'head' }, tree: { sha: 'base' }, sha: 'new', html_url: 'https://github.com/c/new' });
}) as typeof fetch;

/** What the browser does: send the file in parts, then ask for the commit. */
async function send(title: string, name: string, bytes: Uint8Array, category = 'reports') {
  const parts: string[] = [];
  for (let at = 0; at < bytes.length; at += PART_BYTES) {
    const f = new FormData();
    f.set('part', new Blob([bytes.slice(at, at + PART_BYTES)]));
    const r = await handlePart(f);
    if (r.status !== 201) return r;
    parts.push(r.body.sha!);
  }
  return handleUpload({ name, title, category, parts }, 'Asha', catalog, new Date('2026-11-18T10:00:00Z'));
}
const pdf = (size: number) => {
  const b = new Uint8Array(size).map((_, i) => i % 251);
  b.set(PDF);
  return b;
};

const big = pdf(10 * MB); // exactly the limit: 4 parts
let r = await send('Q3 Report', 'anything.pdf', big);
assert.equal(r.status, 201);
assert.equal(r.body.path, 'Content/reports/q3-report.pdf');
assert.equal(calls.filter((c) => c === 'POST /git/blobs').length, 4 + 2, '4 parts, then the joined file and its sidecar');
const saved = Buffer.from(blobs.get(lastTree.find((t) => t.path === 'Content/reports/q3-report.pdf')!.sha)!, 'base64');
assert(saved.equals(Buffer.from(big)), 'the committed file is the parts joined in order');
assert.deepEqual(JSON.parse(Buffer.from(blobs.get(lastTree[1].sha)!, 'base64').toString()), { title: 'Q3 Report', by: 'Asha', at: '2026-11-18T10:00:00.000Z' });

calls = [];
moves = 1;
assert.equal((await send('Q3 Report', 'a.pdf', pdf(1000))).status, 201, 'retries when another upload lands first');
assert.equal(calls.filter((c) => c.startsWith('PATCH')).length, 2);

calls = [];
taken = true;
assert.equal((await send('Q3 Report', 'a.pdf', pdf(1000))).status, 409, 'never overwrites');
assert(!calls.some((c) => c.startsWith('PATCH')), 'a refused upload must not move main');
taken = false;

assert.equal((await send('Too Big', 'a.pdf', pdf(10 * MB + 1))).status, 400, 'over 10 MB');
assert.equal((await send('Renamed', 'a.pdf', new Uint8Array(ZIP))).status, 400, 'checks the bytes, not just the name');
const tooBigPart = new FormData();
tooBigPart.set('part', new Blob([new Uint8Array(PART_BYTES + 1)]));
assert.equal((await handlePart(tooBigPart)).status, 400, 'a part over 3 MB is refused');

calls = [];
assert.equal((await handlePart(new FormData())).status, 400, 'a request with no part');
const meta = { name: 'a.pdf', title: 'Q3 Report', category: 'reports', parts: ['a'.repeat(40)] };
for (const bad of [null, { ...meta, parts: [] }, { ...meta, parts: ['../etc'] }, { ...meta, parts: Array(5).fill('a'.repeat(40)) }, { ...meta, title: ' ' }, { ...meta, category: 'finance' }, { ...meta, name: 'x.html' }])
  assert.equal((await handleUpload(bad, 'Asha', catalog)).status, 400, JSON.stringify(bad));
assert.equal(calls.length, 0, 'invalid uploads never reach GitHub');

const { items, problems } = loadContent();
const members = parseMembers(readFileSync(MEMBERS_FILE, 'utf8'));
if (members.problems.length) console.error(members.problems.join('\n'));
if (!members.hashes.length) console.warn('.members is empty, so nobody can upload yet. Add yourself: npm run add-member name@nitp.ac.in');
if (problems.length || members.problems.length) process.exit(1); // loadContent already printed its problems
console.log(`Rules OK. ${items.length} files in Content/ are valid. ${members.hashes.length} members in .members.`);
