import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import catalog from '@/Content/catalog.json';
import AuthButton from '@/components/AuthButton';
import PageHeader from '@/components/PageHeader';
import UploadForm from '@/components/UploadForm';
import { authOptions } from '@/lib/auth';

export const metadata: Metadata = { title: 'Upload', robots: { index: false } };

const trail: [string, string][] = [['/upload', 'Upload']];

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return (
      <PageHeader trail={trail} title="Upload a document" meta="Anyone can add files. Sign in with Google first, so your name can be shown next to what you add.">
        <div className="mt-8">
          <AuthButton action="in" />
        </div>
      </PageHeader>
    );
  const { category } = await searchParams;
  const initial = catalog.categories.some((c) => c.slug === category) ? category! : catalog.categories[0].slug;
  return (
    <>
      <PageHeader trail={trail} title="Upload a document" meta={`Signed in as ${session.user.name ?? session.user.email}. Your name is shown next to every file you add.`}>
        <div className="mt-6">
          <AuthButton action="out" />
        </div>
      </PageHeader>
      <UploadForm categories={catalog.categories} initial={initial} />
    </>
  );
}
