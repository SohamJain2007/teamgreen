export function LogoMark({ size = 32 }: { size?: number }) {
  // Location pin holding a sal leaf, with a ripple of Ranchi Lake beneath.
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#1A7A50" />
      <path d="M32 6c-10 0-18 7.7-18 17.2C14 36 32 58 32 58s18-22 18-34.8C50 13.7 42 6 32 6z" fill="#FFFFFF" />
      <path d="M32 12.5c-5 3.4-6.6 7.6-5.4 12.2 1 3 3.4 4.8 5.4 4.8s4.4-1.8 5.4-4.8c1.2-4.6-.4-8.8-5.4-12.2z" fill="#1A7A50" />
      <path d="M32 15v14.5" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M22 50c4 2 7-1 10 0s6 2 10 0" fill="none" stroke="#7CC3CC" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
