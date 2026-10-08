// Decorative Ranchi motifs, drawn as original flat illustrations (no photos, no external assets).

/**
 * Skyline: Pahari Mandir hill with its tall tricolour flag, rolling Chota Nagpur plateau hills, a waterfall
 * (Hundru / Dassam / Jonha: Ranchi is "the City of Waterfalls"), sal trees and the still water of Ranchi Lake.
 */
export function RanchiSkyline({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 800 220" preserveAspectRatio="xMidYMax meet" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="sr-fall" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity=".95" />
          <stop offset="1" stopColor="#BFE6EA" stopOpacity=".9" />
        </linearGradient>
        <linearGradient id="sr-lake" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#7CC3CC" />
          <stop offset="1" stopColor="#0A7C8C" />
        </linearGradient>
      </defs>

      {/* sun */}
      <circle cx="610" cy="58" r="30" fill="#FBD9B0" opacity=".9" />

      {/* far plateau hills */}
      <path d="M0 150 C80 110 150 120 220 128 S360 96 440 116 S600 88 680 110 S770 120 800 112 V220 H0Z" fill="#B9DECB" />

      {/* Pahari Mandir hill, temple and flag */}
      <path d="M40 220 C80 160 120 120 170 112 C220 120 262 160 300 220Z" fill="#7DBE9C" />
      <g transform="translate(0 4)">
      <rect x="156" y="104" width="28" height="9" rx="1" fill="#EADFC8" />
      <path d="M161 104 C161 94 166 86 170 80 C174 86 179 94 179 104Z" fill="#F4ECDC" stroke="#C9B48E" strokeWidth="1" />
      <path d="M170 80 v-8 l7 3 l-7 3" fill="#DD5A26" stroke="#DD5A26" strokeWidth="0.8" strokeLinejoin="round" />
      </g>
      <rect x="196" y="22" width="2.5" height="100" fill="#4B5D55" />
      <rect x="198.5" y="22" width="26" height="6" fill="#FF9933" />
      <rect x="198.5" y="28" width="26" height="6" fill="#FFFFFF" />
      <rect x="198.5" y="34" width="26" height="6" fill="#138808" />
      <circle cx="211.5" cy="31" r="1.8" fill="#000080" />

      {/* waterfall cliff */}
      <path d="M560 220 V120 C590 100 640 96 700 108 C740 116 780 124 800 130 V220Z" fill="#4E9C78" />
      <path d="M612 112 C618 150 614 185 606 220 H654 C646 185 642 150 648 108Z" fill="url(#sr-fall)" />
      <path d="M624 120 v80 M634 116 v92 M642 118 v70" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity=".7" />

      {/* near hill */}
      <path d="M260 220 C320 170 400 160 470 172 C520 180 560 196 600 220Z" fill="#3E8F68" />

      {/* sal trees: straight trunks, rounded crowns */}
      {[
        [330, 176, 1], [356, 170, 1.2], [384, 178, 0.9], [470, 176, 1.1], [498, 182, 0.85], [720, 160, 1.15], [748, 166, 0.9],
      ].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <rect x="-1.5" y="0" width="3" height="26" fill="#2B4A3A" />
          <ellipse cx="0" cy="-4" rx="11" ry="15" fill={i % 2 ? '#1A7A50' : '#24905F'} />
        </g>
      ))}

      {/* Ranchi Lake */}
      <path d="M0 196 C140 188 300 192 420 196 S680 190 800 194 V220 H0Z" fill="url(#sr-lake)" />
      <path d="M60 206 h50 M180 210 h70 M330 205 h40 M470 211 h60 M640 206 h55 M720 212 h40" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}

/** Thin border band inspired by Sohrai / Khovar wall art of Jharkhand: zig-zag hills with dots, in earth and leaf tones. */
export function SohraiBand({ className = '' }: { className?: string }) {
  return (
    <svg className={className} height="10" width="100%" aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <pattern id="sr-sohrai" width="24" height="10" patternUnits="userSpaceOnUse">
          <rect width="24" height="10" fill="#1A7A50" />
          <path d="M0 10 L6 2 L12 10Z" fill="#F5F9F6" />
          <path d="M12 10 L18 2 L24 10Z" fill="#DD5A26" />
          <circle cx="6" cy="7.5" r="1.2" fill="#1A7A50" />
          <circle cx="18" cy="7.5" r="1.2" fill="#F5F9F6" />
        </pattern>
      </defs>
      <rect width="100%" height="10" fill="url(#sr-sohrai)" />
    </svg>
  );
}

export function SalLeaf({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 2C6 6 4 11 5.5 16.5 7 20 10 22 12 22s5-2 6.5-5.5C20 11 18 6 12 2z" fill="currentColor" />
      <path d="M12 5v17M12 11l-3-2.5M12 11l3-2.5M12 15.5l-3.5-2.5M12 15.5l3.5-2.5" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" opacity=".8" fill="none" />
    </svg>
  );
}
