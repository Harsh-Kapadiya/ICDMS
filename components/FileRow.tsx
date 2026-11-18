import { Download, Eye, FileImage, FileSpreadsheet, FileText, Presentation } from 'lucide-react';
import Preview from './Preview';
import ShareButton from './ShareButton';
import { buttonVariants } from '@/components/ui/button';
import { anchor, fmtSize, TYPES, type Item } from '@/lib/rules';
import { cn } from '@/lib/utils';

const ICONS: Record<string, typeof FileText> = { pptx: Presentation, xlsx: FileSpreadsheet, png: FileImage, jpg: FileImage, jpeg: FileImage };

// Row actions: 44px tall on phones, compact on desktop
const action = cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-11 gap-1.5 px-2.5 md:h-9 md:px-3 [&_svg]:size-4');

/** One document: what it is, who added it, and View / Download / Share. */
export default function FileRow({ item, where }: { item: Item; where?: string }) {
  const href = `/${item.path}`; // Content/ is published at /Content/ by the build
  const type = TYPES[item.ext];
  const Icon = ICONS[item.ext] ?? FileText;
  const date = item.at && new Date(item.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const meta = [where, type.label, fmtSize(item.bytes), item.by && `added by ${item.by}`, date].filter(Boolean).join(' · ');
  return (
    <li id={anchor(item)} className="lazy-row flex scroll-mt-24 flex-wrap items-center gap-x-1 px-3 py-2 md:px-4">
      <span className="mr-auto flex min-w-0 items-center gap-3 py-2 pr-2">
        <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0">
          <span className="block">{item.title}</span>
          <span className="block text-sm text-muted-foreground">{meta}</span>
        </span>
      </span>
      <span className="flex">
        {/* Word, PowerPoint and Excel files can't open in a browser tab, so they only download */}
        {type.inline && (
          <a className={action} href={href} target="_blank" rel="noopener">
            <Eye aria-hidden />
            View
          </a>
        )}
        <a className={action} href={href} download={item.file}>
          <Download aria-hidden />
          Download
        </a>
        <ShareButton className={action} path={`/${item.category}#${anchor(item)}`} title={item.title} />
      </span>
      {type.inline && <Preview src={href} title={item.title} className={action} />}
    </li>
  );
}
