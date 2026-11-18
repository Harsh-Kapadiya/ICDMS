'use client';
import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

/** Share a document or folder: the phone's share sheet, or copy the link. */
export default function ShareButton({ path, title, className, label = 'Share' }: { path: string; title: string; className: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = new URL(path, location.origin).href;
    try {
      if (navigator.share) return await navigator.share({ title, text: `${title}, on ICDMS`, url });
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // the share sheet was closed; nothing to do
    }
  };
  return (
    <button type="button" onClick={share} className={className}>
      {copied ? <Check aria-hidden /> : <Share2 aria-hidden />}
      <span aria-live="polite">{copied ? 'Link copied' : label}</span>
    </button>
  );
}
