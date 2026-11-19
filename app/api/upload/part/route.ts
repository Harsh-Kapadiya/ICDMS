import { DENIED, memberName } from '@/lib/auth';
import { handlePart } from '@/lib/upload';

export async function POST(req: Request) {
  if (!(await memberName())) return Response.json({ error: DENIED }, { status: 403 });
  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: 'The upload could not be read' }, { status: 400 });
  const { status, body } = await handlePart(form);
  return Response.json(body, { status });
}
