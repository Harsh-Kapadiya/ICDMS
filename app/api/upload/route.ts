import { getServerSession } from 'next-auth';
import catalog from '@/Content/catalog.json';
import { authOptions } from '@/lib/auth';
import { handleUpload } from '@/lib/upload';

// Anyone signed in may upload; the rules in handleUpload decide what is accepted.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: 'Your sign-in has ended. Sign in again to upload.' }, { status: 401 });
  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: 'The upload could not be read. Files must be under 4 MB.' }, { status: 400 });
  const { status, body } = await handleUpload(form, session.user.name || 'Someone', catalog);
  return Response.json(body, { status });
}
