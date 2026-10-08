import { getT } from '@/lib/lang-server';
import { getWardFile, type Ward } from '@/lib/wards';
import { UnverifiedBadge } from './ui';
import type { Key } from '@/lib/translations';

function PhoneLinks({ phone, label }: { phone: string; label: string }) {
  return (
    <span className="flex flex-wrap gap-x-3">
      {phone.split('/').map((p) => (
        <a key={p} href={`tel:${p.trim()}`} className="font-semibold text-laterite-dark underline" aria-label={`${label} ${p}`}>
          {p.trim()}
        </a>
      ))}
    </span>
  );
}

/** Ward councillor + RMC-level officials + helpline. Unverified entries always carry a badge. */
export default async function Officials({ ward }: { ward: Ward | null | undefined }) {
  const { t } = await getT();
  const file = getWardFile();
  return (
    <div className="space-y-2">
      <div className="card p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('r.councillor')}{ward ? ` · ${t('ward.title', { n: ward.wardNumber })}` : ''}</p>
        {ward?.councillorName ? (
          <>
            <p className="mt-0.5 text-lg font-semibold">{ward.councillorName}</p>
            {ward.councillorPhone && <PhoneLinks phone={ward.councillorPhone} label={t('call')} />}
            {!ward.verified && <UnverifiedBadge className="mt-1.5" />}
          </>
        ) : (
          <p className="mt-0.5 text-muted">{t('ward.noCouncillor')}</p>
        )}
      </div>
      <div className="card divide-y divide-line">
        {file.rmcOfficials.map((o) => (
          <div key={o.role} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 p-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t(`official.${o.role}` as Key)}</p>
              <p className="font-semibold">{o.name ?? <span className="font-normal text-muted">{t('official.notAvailable')}</span>}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {o.phone && <PhoneLinks phone={o.phone} label={t('call')} />}
              {o.name && !o.verified && <UnverifiedBadge />}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('official.helpline')}</p>
            <a href={`tel:${file.meta.rmcHelpline.phone}`} className="font-semibold text-laterite-dark underline">
              {file.meta.rmcHelpline.phone}
            </a>
          </div>
          {!file.meta.rmcHelpline.verified && <UnverifiedBadge />}
        </div>
      </div>
    </div>
  );
}
