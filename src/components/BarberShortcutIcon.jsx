function Sparkle({x, y, size = 2.2}) {
  return <path d={`M${x} ${y - size} C${x - size * .35} ${y - size * .35} ${x - size * .35} ${y - size * .35} ${x - size} ${y} C${x - size * .35} ${y + size * .35} ${x - size * .35} ${y + size * .35} ${x} ${y + size} C${x + size * .35} ${y + size * .35} ${x + size * .35} ${y + size * .35} ${x + size} ${y} C${x + size * .35} ${y - size * .35} ${x + size * .35} ${y - size * .35} ${x} ${y - size}Z`} fill="currentColor" stroke="none" />;
}

function TodayIcon() {
  return <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.4 16.6A12.4 12.4 0 0 1 23.8 7.1" strokeWidth="1.35" />
    <path d="M28.15 15.52A12.4 12.4 0 0 1 7.03 25.37" strokeWidth="1.35" />
    <circle cx="15.8" cy="16.6" r="9.15" strokeWidth="1.35" />
    <path d="M15.8 10.2v6.2l4.1 2.1" strokeWidth="1.35" />
    <path d="M15.8 3.7v3.8" strokeWidth="1.35" />
    <Sparkle x={27.1} y={7.3} size={2.15} />
  </g>;
}

function InspirationIcon() {
  return <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.73 19.56A12.6 12.6 0 0 1 15.9 3.7" strokeWidth="1.35" />
    <path d="M28.06 13.04A12.6 12.6 0 0 1 18.52 28.62" strokeWidth="1.35" />
    <path d="m15.9 9.1 6.9 7.2-6.9 7.2L9 16.3l6.9-7.2Z" strokeWidth="1.35" />
    <path d="M15.9 11.9c-.8 2.8-1.7 3.6-4.3 4.4 2.6.8 3.5 1.6 4.3 4.4.8-2.8 1.7-3.6 4.3-4.4-2.6-.8-3.5-1.6-4.3-4.4Z" fill="currentColor" stroke="none" />
    <Sparkle x={26.8} y={7.1} size={2.05} />
  </g>;
}

function PromotionsIcon() {
  return <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 5.5h18a2 2 0 0 1 2 2v3.1a3.4 3.4 0 0 0 0 6.8v3.1a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-3.1a3.4 3.4 0 0 0 0-6.8V7.5a2 2 0 0 1 2-2Z" strokeWidth="1.8" />
    <path d="m12.2 17.2 7.6-7.6" strokeWidth="2.1" />
    <circle cx="12.1" cy="10.1" r="1.65" fill="currentColor" stroke="none" />
    <circle cx="19.9" cy="16.7" r="1.65" fill="currentColor" stroke="none" />
    <path d="M15.8 3.2v2.1M15.8 21.7v2.1" strokeWidth="1.5" opacity=".65" />
  </g>;
}

export default function BarberShortcutIcon({kind}) {
  return <svg className={`meryo-barber-shortcut-icon meryo-barber-shortcut-icon--${kind}`} aria-hidden="true" focusable="false" viewBox="0 0 32 32">
    {kind === 'today' ? <TodayIcon /> : kind === 'inspiration' ? <InspirationIcon /> : <PromotionsIcon />}
  </svg>;
}
