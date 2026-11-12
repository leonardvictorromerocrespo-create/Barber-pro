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
  return <g transform="translate(-2.4 -2.4) scale(1.15)" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6.1 20.2Q5.8 19.7 6.3 19.2L17.6 7.8Q18 7.4 18.5 7.3L27.3 6.2Q28.2 6.1 28 7L26.5 15.6Q26.4 16 26 16.4L13.6 28.2Q13 28.8 12.4 28.2Z" strokeWidth="1.2" />
    <g transform="translate(1 1)">
      <path d="m14.4 18 3.2-3.2" strokeWidth="1.5" />
      <circle cx="14.2" cy="15" r=".82" fill="currentColor" stroke="none" />
      <circle cx="17.8" cy="18" r=".82" fill="currentColor" stroke="none" />
    </g>
    <circle cx="23.1" cy="10.3" r="1.75" strokeWidth=".7" />
    <circle cx="23.1" cy="10.3" r=".45" fill="currentColor" stroke="none" />
    <path d="M24.4 8.5q1.15-.85 1.85.25" strokeWidth=".65" />
  </g>;
}

export default function BarberShortcutIcon({kind}) {
  return <svg className={`meryo-barber-shortcut-icon meryo-barber-shortcut-icon--${kind}`} aria-hidden="true" focusable="false" viewBox="0 0 32 32">
    {kind === 'today' ? <TodayIcon /> : kind === 'inspiration' ? <InspirationIcon /> : <PromotionsIcon />}
  </svg>;
}
