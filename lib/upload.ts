import { addUpload, getBlob, putBlob, Taken } from './github.ts';
import { check, checkPath, checkTitle, extOf, MAX_PARTS, PART_BYTES, targetPath, type Catalog } from './rules.ts';

// The two upload routes minus sign-in, so the CI check can run them against a fake GitHub.
// This is the trust boundary: the browser checks the same rules first, but only for quick feedback.

type Result = { status: number; body: { sha?: string; url?: string; path?: string; error?: string } };
const SHA = /^[0-9a-f]{40}$/;

/** Step 1, once per part (at most 3 MB): store it as a Git blob and hand back its id. */
export async function handlePart(form: FormData): Promise<Result> {
  const part = form.get('part');
  if (!(part instanceof Blob) || part.size === 0 || part.size > PART_BYTES) return { status: 400, body: { error: 'The upload could not be read' } };
  try {
    return { status: 201, body: { sha: await putBlob(new Uint8Array(await part.arrayBuffer())) } };
  } catch (e) {
    console.error(e);
    return { status: 502, body: { error: 'Could not reach GitHub. Try again in a minute.' } };
  }
}

/**
 * Step 2: join the parts, check the whole file, commit it with its sidecar.
 * ponytail: part ids aren't signed; a member could name any blob in this public repo, which is harmless since the joined bytes are checked like any upload
 */
export async function handleUpload(body: unknown, by: string, catalog: Catalog, now = new Date()): Promise<Result> {
  const { name, title: rawTitle, category, parts } = (body ?? {}) as Record<string, unknown>;
  const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
  if (typeof name !== 'string' || typeof category !== 'string' || !Array.isArray(parts) || !parts.length || parts.length > MAX_PARTS || !parts.every((p) => typeof p === 'string' && SHA.test(p)))
    return { status: 400, body: { error: 'The upload could not be read' } };
  const titleProblem = checkTitle(title);
  if (titleProblem) return { status: 400, body: { error: titleProblem } };
  const path = targetPath(category, title, extOf(name));
  const where = checkPath(path, catalog); // cheap checks first, before fetching anything
  if (typeof where === 'string') return { status: 400, body: { error: where } };

  try {
    const bytes = Buffer.concat(await Promise.all((parts as string[]).map(getBlob)));
    const result = check(path, bytes.length, bytes, catalog);
    if (typeof result === 'string') return { status: 400, body: { error: result } };
    const url = await addUpload(path, bytes, { title, by, at: now.toISOString() }, `content: add ${path.slice('Content/'.length)} (uploaded by ${by})`);
    return { status: 201, body: { url, path } };
  } catch (e) {
    if (e instanceof Taken) return { status: 409, body: { error: 'A file with this title is already in this folder. Use a different title.' } };
    console.error(e);
    return { status: 502, body: { error: 'Could not save the file to GitHub. Try again in a minute.' } };
  }
}
