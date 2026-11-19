import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import catalog from '@/Content/catalog.json';
import members from '@/members.json';
import AuthButton from '@/components/AuthButton';
import PageHeader from '@/components/PageHeader';
import UploadForm from '@/components/UploadForm';
import { authOptions } from '@/lib/auth';
import { isMember } from '@/lib/rules';

export const metadata: Metadata = { title: 'Upload', robots: { index: false } };

const trail: [string, string][] = [['/upload', 'Upload']];
const NOT_MEMBER = "That account isn't on the IC members list. Sign in with your official college email, or ask the IC team to add you to members.json.";

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ category?: string; error?: string }> }) {
  const { category, error } = await searchParams;
  const user = (await getServerSession(authOptions))?.user;

  if (!user)
    return (
      <PageHeader
        trail={trail}
        title="Upload a document"
        meta={
          error === 'AccessDenied'
            ? NOT_MEMBER
            : error
              ? 'Sign-in did not work. Try again.'
              : 'Uploading is for Incubation Center members. Sign in with your official college email.'
        }
      >
        <div className="mt-8">
          <AuthButton action="in" />
        </div>
      </PageHeader>
    );

  // Signed in, but taken off the list since (a session lasts up to 30 days)
  if (!isMember(user.email, members.emails))
    return (
      <PageHeader trail={trail} title="Upload a document" meta={NOT_MEMBER}>
        <div className="mt-6">
          <AuthButton action="out" />
        </div>
      </PageHeader>
    );

  const initial = catalog.categories.some((c) => c.slug === category) ? category! : catalog.categories[0].slug;
  return (
    <>
      <PageHeader trail={trail} title="Upload a document" meta={`Signed in as ${user.name ?? user.email}. Your name is shown next to every file you add.`}>
        <div className="mt-6">
          <AuthButton action="out" />
        </div>
      </PageHeader>
      <UploadForm categories={catalog.categories} initial={initial} />
    </>
  );
}
