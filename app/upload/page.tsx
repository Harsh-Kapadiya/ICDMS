import type { Metadata } from 'next';
import { LogOut } from 'lucide-react';
import catalog from '@/Content/catalog.json';
import PageHeader from '@/components/PageHeader';
import SignIn from '@/components/SignIn';
import UploadForm from '@/components/UploadForm';
import { Button } from '@/components/ui/button';
import { getSession } from '@/lib/auth';
import { isMember } from '@/lib/members';

export const metadata: Metadata = { title: 'Upload', robots: { index: false } };

const trail: [string, string][] = [['/upload', 'Upload']];

const SignOut = () => (
  <form action="/api/logout" method="post" className="mt-6">
    <Button type="submit" variant="outline" className="gap-2">
      <LogOut aria-hidden className="size-4" />
      Sign out
    </Button>
  </form>
);

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ category?: string; error?: string }> }) {
  const { category, error } = await searchParams;
  const session = await getSession();

  if (!session)
    return (
      <PageHeader
        trail={trail}
        title="Upload a document"
        meta={
          error === 'link'
            ? "That sign-in link has expired or isn't valid. Ask for a new one below."
            : 'Uploading is for Incubation Center members. Enter your official college email and we will email you a sign-in link.'
        }
      >
        <SignIn />
      </PageHeader>
    );

  // Signed in, but taken off .members since (the sign-in cookie lasts 30 days)
  if (!isMember(session.email))
    return (
      <PageHeader trail={trail} title="Upload a document" meta="Your email is no longer on the IC members list, so you can't upload. Ask the IC team if this is a mistake.">
        <SignOut />
      </PageHeader>
    );

  const initial = catalog.categories.some((c) => c.slug === category) ? category! : catalog.categories[0].slug;
  return (
    <>
      <PageHeader trail={trail} title="Upload a document" meta={`Signed in as ${session.name} (${session.email}). Your name is shown next to every file you add.`}>
        <SignOut />
      </PageHeader>
      <UploadForm categories={catalog.categories} initial={initial} />
    </>
  );
}
