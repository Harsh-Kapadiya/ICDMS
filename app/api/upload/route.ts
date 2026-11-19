import catalog from '@/Content/catalog.json';
import { DENIED, memberName } from '@/lib/auth';
import { handleUpload } from '@/lib/upload';

export const maxDuration = 60; // joining and committing a 10 MB file takes a few seconds

export async function POST(req: Request) {
  const by = await memberName();
  if (!by) return Response.json({ error: DENIED }, { status: 403 });
  const { status, body } = await handleUpload(await req.json().catch(() => null), by, catalog);
  return Response.json(body, { status });
}
