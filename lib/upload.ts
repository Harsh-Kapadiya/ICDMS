import { addUpload, Taken } from './github.ts';
import { check, checkTitle, extOf, targetPath, type Catalog } from './rules.ts';

type Result = { status: number; body: { url?: string; path?: string; error?: string } };

/**
 * The upload route minus sign-in, so the CI check can run it against a fake GitHub.
 * This is the trust boundary: the browser checks the same rules first, but only for quick feedback.
 */
export async function handleUpload(form: FormData, by: string, catalog: Catalog, now = new Date()): Promise<Result> {
  const file = form.get('file');
  const category = String(form.get('category') ?? '');
  const title = String(form.get('title') ?? '').trim();
  if (!(file instanceof File)) return { status: 400, body: { error: 'No file was sent' } };
  const titleProblem = checkTitle(title);
  if (titleProblem) return { status: 400, body: { error: titleProblem } };

  const path = targetPath(category, title, extOf(file.name));
  const result = check(path, file.size, new Uint8Array(await file.slice(0, 5).arrayBuffer()), catalog);
  if (typeof result === 'string') return { status: 400, body: { error: result } };

  try {
    const data = Buffer.from(await file.arrayBuffer()).toString('base64');
    const url = await addUpload(path, data, { title, by, at: now.toISOString() }, `content: add ${path.slice('Content/'.length)} (uploaded by ${by})`);
    return { status: 201, body: { url, path } };
  } catch (e) {
    if (e instanceof Taken) return { status: 409, body: { error: 'A file with this title is already in this category. Use a different title.' } };
    console.error(e);
    return { status: 502, body: { error: 'Could not save the file to GitHub. Try again in a minute.' } };
  }
}
