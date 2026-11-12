const artwork = {
  today: <>
    <circle cx="15" cy="17" r="10.3"/>
    <path d="M15 10.8v6.4l4.2 2.3M8.2 4.5l-3.5 3.2m20.7-3.2 3.4 3.2"/>
    <path className="meryo-shortcut-accent" d="M24.3 3.4v5.2m-2.6-2.6h5.2"/>
    <path d="M8.1 2.9h6.1"/>
  </>,
  inspiration: <>
    <path d="m7.2 15.8 9.3-10.5 9.1 10.4-9.3 10.1-9.1-10Z"/>
    <path d="m11.5 15.7 4.9-5.5 4.8 5.4-4.9 5.3-4.8-5.2Z"/>
    <path className="meryo-shortcut-accent" d="M25.6 3v5.1m-2.5-2.55h5"/>
    <path d="m5.5 6.5 2 2m-2-2-2 2"/>
  </>,
  promotions: <>
    <g transform="rotate(-43 16 16)">
      <path d="M6 10.5h17.5l3 3v5l-3 3H6a2.5 2.5 0 0 1-2.5-2.5v-6A2.5 2.5 0 0 1 6 10.5Z"/>
      <circle cx="21.4" cy="16" r="1.1"/>
      <text className="meryo-shortcut-percent" x="10.1" y="18.1">%</text>
    </g>
  </>,
};

export default function BarberShortcutIcon({kind}) {
  return <svg className="meryo-barber-shortcut-icon" aria-hidden="true" focusable="false" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
    {artwork[kind]}
  </svg>;
}
