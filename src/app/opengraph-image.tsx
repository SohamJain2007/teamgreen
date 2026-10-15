import { ImageResponse } from 'next/og';

// Link preview for every page (WhatsApp, X, Facebook ...). Report pages override it with the photo of the spot.
export const alt = 'SafaiRanchi: report garbage spots in Ranchi and track them until they are clean';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: 'linear-gradient(135deg, #125C3B 0%, #1A7A50 55%, #0A7C8C 100%)', color: '#FFFFFF' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <svg width="112" height="112" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="14" fill="#FFFFFF" />
            <path d="M32 6c-10 0-18 7.7-18 17.2C14 36 32 58 32 58s18-22 18-34.8C50 13.7 42 6 32 6z" fill="#1A7A50" />
            <path d="M32 12.5c-5 3.4-6.6 7.6-5.4 12.2 1 3 3.4 4.8 5.4 4.8s4.4-1.8 5.4-4.8c1.2-4.6-.4-8.8-5.4-12.2z" fill="#FFFFFF" />
            <path d="M22 50c4 2 7-1 10 0s6 2 10 0" fill="none" stroke="#0A7C8C" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
          <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -1 }}>SafaiRanchi</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1, maxWidth: 980 }}>Spot a garbage dump in Ranchi? Report it in 30 seconds.</div>
          <div style={{ fontSize: 34, opacity: 0.9 }}>Photo + location, no sign-up. Tracked in public until it is clean.</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 28 }}>
          <div style={{ display: 'flex', gap: 16 }}>
            {['Reported', 'Acknowledged', 'Cleared'].map((s, i) => (
              <div key={s} style={{ display: 'flex', padding: '10px 22px', borderRadius: 999, background: i === 2 ? '#FFFFFF' : 'rgba(255,255,255,0.16)', color: i === 2 ? '#125C3B' : '#FFFFFF', fontWeight: 600 }}>
                {s}
              </div>
            ))}
          </div>
          <div style={{ opacity: 0.85 }}>An initiative by Team G.R.E.E.N.</div>
        </div>
      </div>
    ),
    size,
  );
}
