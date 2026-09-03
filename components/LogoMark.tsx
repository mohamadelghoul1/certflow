// The gold-ring-and-tick mark from the artwork, drawn as its own graphic
// so it is crisp at any size and can go on letterheads later if wanted.
//
// The gradient needs an id, and two marks on one page with the same id
// would share (and fight over) it — so a page that draws it twice gives
// each its own.
export function LogoMark({ size, id = "certlyn-logo-gold" }: { size: number; id?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f5c045" />
          <stop offset="1" stopColor="#d98a1f" />
        </linearGradient>
      </defs>
      <path d="M 51 13.5 A 24 24 0 1 0 55.5 43" fill="none" stroke={`url(#${id})`} strokeWidth="8" strokeLinecap="round" />
      <path d="M 26 32 L 36 42 L 56 20" fill="none" stroke={`url(#${id})`} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
