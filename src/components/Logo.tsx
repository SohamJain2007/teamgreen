export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#B5361E" />
      <path d="M32 6c-10 0-18 7.7-18 17.2C14 36 32 58 32 58s18-22 18-34.8C50 13.7 42 6 32 6z" fill="#FBF6EE" />
      <circle cx="32" cy="23" r="10.5" fill="#B5361E" />
      <path d="M26.5 23.5l4.2 4.2 7-8.2" fill="none" stroke="#FBF6EE" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
