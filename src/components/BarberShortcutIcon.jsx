const artwork = {
  today: <>
    {/* Open clock arcs and hands based on Leo's first reference. */}
    <path d="M6.8 12.1A10.6 10.6 0 0 1 24.9 7M26.2 13.8A10.6 10.6 0 1 1 8.1 8.2" />
    <path d="M15.8 10.2v7.1l5.1 2.5M12.5 3.2a13 13 0 0 1 8.6 1.7" />
    <path className="meryo-shortcut-accent" d="M25.9 2.5v5.4m-2.7-2.7h5.4" />
    <path d="M10.3 3.8a13.6 13.6 0 0 0-4.2 3.4" />
  </>,
  inspiration: <>
    {/* Diamond and curved orbit strokes based on Leo's first reference. */}
    <path d="M7.1 12.8A10.3 10.3 0 0 1 20.2 5.1M24.2 10.2a10.3 10.3 0 0 1-13.1 16" />
    <path d="m11.5 15.9 4.8-5.2 4.9 5.2-4.9 5.3-4.8-5.3Z" />
    <path d="m14.3 15.9 2-2.1 2.1 2.1-2.1 2.2-2-2.2Z" />
    <path className="meryo-shortcut-accent" d="M25.8 2.4v5.4m-2.7-2.7h5.4" />
  </>,
  promotions: <>
    {/* Original price-tag silhouette, slightly longer and tilted. */}
    <g transform="rotate(-43 16 16)">
      <path d="M4.4 13.1 12.8 4.8h12.1v13.2l-8.1 8.1L4.4 14.3a.85.85 0 0 1 0-1.2Z" />
      <circle cx="20.7" cy="9.2" r="1.05" />
    </g>
  </>,
};

export default function BarberShortcutIcon({kind}) {
  return <svg className="meryo-barber-shortcut-icon" aria-hidden="true" focusable="false" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
    {artwork[kind]}
  </svg>;
}
