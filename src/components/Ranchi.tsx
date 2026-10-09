// Decorative Ranchi motifs, drawn as original flat illustrations (no photos, no external assets).

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
