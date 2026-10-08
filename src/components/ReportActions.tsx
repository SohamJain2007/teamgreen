'use client';
import { useEffect, useState } from 'react';
import { useT } from './I18n';

export default function ReportActions({ id, upvotes: initial }: { id: string; upvotes: number }) {
  const t = useT();
  const [upvotes, setUpvotes] = useState(initial);
  const [voted, setVoted] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      setVoted(localStorage.getItem(`sr-up-${id}`) === '1');
      setFlagged(localStorage.getItem(`sr-spam-${id}`) === '1');
    } catch {}
  }, [id]);

  async function up() {
    if (voted) return;
    const r = await fetch(`/api/reports/${id}/upvote`, { method: 'POST' }).catch(() => null);
    if (r?.ok) {
      const d = await r.json();
      setUpvotes(d.upvotes);
      setVoted(true);
      try { localStorage.setItem(`sr-up-${id}`, '1'); } catch {}
    }
  }
  async function spam() {
    if (flagged) return;
    await fetch(`/api/reports/${id}/spam`, { method: 'POST' }).catch(() => null);
    setFlagged(true);
    try { localStorage.setItem(`sr-spam-${id}`, '1'); } catch {}
  }
  async function share() {
    const url = window.location.origin + `/r/${id}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'SafaiRanchi', url }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="space-y-2">
      <p className="font-semibold">{t('r.people', { n: upvotes })}</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={up} disabled={voted} className="btn-primary">
          {voted ? t('r.upped') : t('r.up')}
        </button>
        <button onClick={share} className="btn-ghost">{copied ? t('r.copied') : t('r.share')}</button>
      </div>
      <button onClick={spam} disabled={flagged} className="text-sm text-muted underline disabled:no-underline">
        {flagged ? t('r.spamThanks') : t('r.spam')}
      </button>
    </div>
  );
}
