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
    <path d="M4.2 24.3 Q3.5 23.7 4.2 23 L19.1 8.1 Q19.7 7.5 20.6 7.4 L28.2 5.6 L26.9 13.5 Q26.8 14.2 26.2 14.8 L11.4 29.7 Q10.7 30.4 10 29.7 Z" />
    <circle cx="25.2" cy="9.4" r="1.05" fill="currentColor" stroke="none" />
    <path d="m14.1 20.2 4-4m-3.8.4a.7.7 0 1 0 0-1.4.7.7 0 0 0 0 1.4Zm3.8 5a.7.7 0 1 0 0-1.4.7.7 0 0 0 0 1.4Z" />
  </>,
};

export default function BarberShortcutIcon({kind}) {
  return <svg className={`meryo-barber-shortcut-icon meryo-barber-shortcut-icon--${kind}`} aria-hidden="true" focusable="false" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {artwork[kind]}
  </svg>;
}
