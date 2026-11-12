const artwork = {
  today: <>
    <path d="M5.2 15.2A12 12 0 0 1 25 7.1M26.1 14.8A12 12 0 1 1 8.4 6.5" />
    <path d="M15.7 9.1v7.6l5.1 2.5M11 4.4a14 14 0 0 1 8.7.1" />
    <path className="meryo-shortcut-accent" fill="currentColor" stroke="none" d="M25.8 2.4 27 5.2l2.8 1.1-2.8 1.1-1.2 2.8-1.1-2.8-2.8-1.1 2.8-1.1 1.1-2.8Z" />
  </>,
  inspiration: <>
    <path d="M5.4 14.4A12 12 0 0 1 22 5.2M25.7 11.2a12 12 0 0 1-16.5 16" />
    <path d="m10.8 16 5.1-5.3 5.2 5.3-5.2 5.3-5.1-5.3Z" />
    <path d="m14.1 16 1.8-1.9 1.9 1.9-1.9 1.9-1.8-1.9Z" />
    <path className="meryo-shortcut-accent" fill="currentColor" stroke="none" d="M25.7 2.4 26.9 5l2.7 1.1-2.7 1.1-1.2 2.6-1.1-2.6-2.7-1.1 2.7-1.1 1.1-2.6Z" />
  </>,
  promotions: <>
    <path d="M4.4 20.3a1.25 1.25 0 0 1 .1-1.7L17 6.1a2.1 2.1 0 0 1 1.2-.6l10.1-1.4-1.7 10.2a2.2 2.2 0 0 1-.6 1.1L13.4 28a1.2 1.2 0 0 1-1.7 0l-7.3-7.7Z" />
    <circle cx="23.2" cy="9.8" r="1.25" fill="currentColor" stroke="none" />
    <path d="m11.5 20.1 5.3-5.3m-4.8.7a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Zm4.6 6.3a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z" />
  </>,
};

export default function BarberShortcutIcon({kind}) {
  return <svg className={`meryo-barber-shortcut-icon meryo-barber-shortcut-icon--${kind}`} aria-hidden="true" focusable="false" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {artwork[kind]}
  </svg>;
}
