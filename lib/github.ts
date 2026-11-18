// Server-side GitHub calls. Visitors have no write access to this repository, so uploads are
// committed by the server with one bot token (a fine-grained token limited to this repository's
// contents). The token is read from the environment on the server and never reaches the browser.
import { BRANCH, REPO, type Meta } from './rules.ts';

class GitHubError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
/** Thrown when the upload's path is already taken on main. */
export class Taken extends Error {}

async function gh<T>(path: string, body?: unknown, method = body ? 'POST' : 'GET'): Promise<T> {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    method,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${process.env.GITHUB_UPLOAD_TOKEN}`, Accept: 'application/vnd.github+json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new GitHubError(res.status, `GitHub refused ${method} ${path} (${res.status}): ${(await res.json().catch(() => ({}))).message ?? res.statusText}`);
  return res.json();
}

const exists = (path: string, ref: string) =>
  gh(`/contents/${path}?ref=${ref}`).then(
    () => true,
    (e) => (e instanceof GitHubError && e.status === 404 ? false : Promise.reject(e)),
  );

/**
 * Adds one file and its sidecar to main as a single commit, never overwriting anything. The blobs
 * upload once. If another upload lands first, main has moved, GitHub refuses our non-forced ref
 * update, and we rebuild on the new head; the "already exists" check runs against that same head,
 * so two people choosing the same name at the same moment cannot overwrite each other.
 */
export async function addUpload(path: string, base64: string, meta: Meta, message: string, attempts = 3) {
  const blob = async (content: string, encoding: string) => (await gh<{ sha: string }>('/git/blobs', { content, encoding })).sha;
  const tree = [
    { path, mode: '100644', type: 'blob', sha: await blob(base64, 'base64') },
    { path: `${path}.json`, mode: '100644', type: 'blob', sha: await blob(`${JSON.stringify(meta, null, 2)}\n`, 'utf-8') },
  ];
  for (let attempt = 1; ; attempt++) {
    const parent = (await gh<{ object: { sha: string } }>(`/git/ref/heads/${BRANCH}`)).object.sha;
    if (await exists(path, parent)) throw new Taken(path);
    const { tree: base } = await gh<{ tree: { sha: string } }>(`/git/commits/${parent}`);
    const { sha: treeSha } = await gh<{ sha: string }>('/git/trees', { base_tree: base.sha, tree });
    const made = await gh<{ sha: string; html_url: string }>('/git/commits', { message, tree: treeSha, parents: [parent] });
    try {
      await gh(`/git/refs/heads/${BRANCH}`, { sha: made.sha }, 'PATCH');
      return made.html_url;
    } catch (e) {
      // 422 "not a fast forward": someone else's upload landed between our read and our write
      if (!(e instanceof GitHubError && e.status === 422) || attempt >= attempts) throw e;
    }
  }
}
