import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <PageHeader
      trail={[['/404', 'Not found']]}
      title="Not on file."
      meta="This page isn't in ICDMS. The link may be old or mistyped. The document itself could still be here: try Search at the top."
    >
      <Button asChild className="mt-8">
        <Link href="/">Back to all folders</Link>
      </Button>
    </PageHeader>
  );
}
