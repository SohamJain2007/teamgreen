'use client';
import { useState } from 'react';

/** Native share sheet, falling back to copying the link. */
export default function ShareButton({ title, label, copiedLabel, path }: { title: string; label: string; copiedLabel: string; path?: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = window.location.origin + (path ?? window.location.pathname);
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }
  return (
    <button onClick={share} aria-label={label} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-muted hover:text-ink" title={copied ? copiedLabel : label}>
      {copied ? '✓' : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
        </svg>
      )}
    </button>
  );
}
