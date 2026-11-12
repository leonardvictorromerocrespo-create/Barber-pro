function Sparkle({x, y, size = 2.2}) {
  return <path d={`M${x} ${y - size} Q${x + .55} ${y - .55} ${x + size} ${y} Q${x + .55} ${y + .55} ${x} ${y + size} Q${x - .55} ${y + .55} ${x - size} ${y} Q${x - .55} ${y - .55} ${x} ${y - size}Z`} fill="currentColor" stroke="none" />;
}

function TodayIcon() {
  return <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.4 16.6A12 12 0 0 1 23.8 7.9" strokeWidth="1.45" />
    <path d="M27.3 17.8A12 12 0 0 1 8 27.1" strokeWidth="1.45" />
    <path d="M5.7 17.8a10.1 10.1 0 1 1 20.2 0 10.1 10.1 0 0 1-20.2 0Z" strokeWidth="1.55" />
    <path d="M15.8 11.5v6.4l4.1 2.4" strokeWidth="1.5" />
    <path d="M11.2 5.9v2.4m7.1-2.7v2.3" strokeWidth="1.2" />
    <Sparkle x={27.2} y={7.6} size={2.4} />
  </g>;
}

function InspirationIcon() {
  return <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.7 18.3A12.2 12.2 0 0 1 16.2 5.5" strokeWidth="1.45" />
    <path d="M28 13.9a12.1 12.1 0 0 1-9.2 13.4" strokeWidth="1.45" />
    <path d="m15.8 10 6.5 6.9-6.5 6.9-6.5-6.9L15.8 10Z" strokeWidth="1.5" />
    <path d="m15.8 13.4 3.3 3.5-3.3 3.5-3.3-3.5 3.3-3.5Z" strokeWidth="1.25" />
    <Sparkle x={26.9} y={7} size={2.25} />
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
