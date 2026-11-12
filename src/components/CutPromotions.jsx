import {useState} from 'react';
import MeryoLogo from './MeryoLogo';
import {MeryoThemeToggle} from './MeryoHeader';
import './CutPromotions.css';

function dateLabel(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00-05:00`);
  return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'short' }).format(date);
}

function OfferCover({url, name}) {
  const [failed,setFailed]=useState(false);
  return <div className="aspect-[4/3] bg-neutral-800">
    {url && !failed
      ? <img src={url} alt={`Portada de ${name}`} loading="lazy" onError={()=>setFailed(true)} className="h-full w-full object-cover" />
      : <div className="flex h-full items-center justify-center px-2 text-center text-xs text-neutral-300">Sin portada</div>}
  </div>;
}

function timeLabel(slot) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(slot?.label ?? '');
  if (!match) return slot?.label ?? '';
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? 'a. m.' : 'p. m.'}`;
}

export function CutPromotions({ offers, loading, error, notice='', onRetry, onBack, onOpenOffer, onNavigate, bannerImage='/cut-promotions-banner.png', BottomNav,themeMode='dark',themeAppearance,onToggleTheme }) {
  const hasLiveOffers=!loading&&!error&&offers.length>0;
  return <div data-meryo-theme="barberia" data-meryo-mode={themeMode} data-meryo-appearance={themeAppearance} className="meryo-cut-promotions min-h-screen bg-neutral-950 pb-24 text-white md:pb-8">
    <header className="sticky top-0 z-20 border-b border-white/10 bg-neutral-950/95 px-4 py-3 backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <MeryoLogo variant={themeMode==='light'?'light':'dark'} className="h-7 w-auto sm:h-9" />
        <div className="flex items-center gap-2"><MeryoThemeToggle mode={themeMode} onToggle={onToggleTheme} className="meryo-promotion-theme-toggle"/><button type="button" onClick={onBack} className="min-h-11 rounded-xl border border-white/20 px-4 py-2 text-sm"><span aria-hidden="true">← </span>Volver</button></div>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
      <section className="meryo-promotions-banner relative isolate flex min-h-60 items-center overflow-hidden rounded-3xl border border-amber-400/20 bg-neutral-900 px-6 py-8 sm:min-h-80 sm:px-10" style={{ '--meryo-promotion-banner': `url("${bannerImage}")` }}>
        <div className="meryo-promotions-banner__copy">
          <p className="text-xs font-bold uppercase tracking-[.28em] text-amber-300">MERYO · promociones</p>
          <h1 className="meryo-promotions-banner__title mt-3 font-black leading-tight text-white" style={{ textShadow: '0 0 18px rgba(232,199,102,.32)' }}>{hasLiveOffers?<>Cortes al <span className="whitespace-nowrap">50 %</span></>:'Promociones de barbería'}</h1>
          <p className="mt-3 text-base font-semibold text-amber-200 sm:text-xl">{hasLiveOffers?'En barberías y horarios participantes':'Consulta las ofertas disponibles'}</p>
        </div>
      </section>

      <section className="mt-7" aria-labelledby="cut-promotions-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div><h2 id="cut-promotions-heading" className="text-2xl font-black sm:text-3xl">Promociones disponibles</h2><p className="mt-1 text-sm text-neutral-400">Solo en cortes y horarios participantes. No incluye barba sola, tintes ni paquetes.</p></div>
          {error && <button type="button" onClick={onRetry} className="min-h-11 rounded-xl border border-amber-400/50 px-4 text-sm font-semibold text-amber-200">Reintentar</button>}
        </div>
        {loading && <p role="status" className="rounded-2xl border border-white/10 bg-neutral-900 p-6 text-neutral-300">Buscando turnos promocionales…</p>}
        {error && <p role="alert" className="mb-4 rounded-2xl border border-red-400/30 bg-red-950/30 p-4 text-red-200">No pudimos cargar las promociones: {error}</p>}
        {notice && <p role="status" className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-amber-100">{notice}</p>}
        {!loading && !error && offers.length === 0 && <p role="status" className="rounded-2xl border border-white/10 bg-neutral-900 p-6 text-neutral-300">No hay promociones disponibles ahora.</p>}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-5 lg:grid-cols-3">
          {!loading && offers.map(offer => {
            const slots = offer.slots ?? [];
            const first = slots[0];
            const hour = timeLabel(first);
            const singleHour = Boolean(hour) && slots.every(slot => timeLabel(slot) === hour);
            return <article key={`${offer.campaign_id}-${offer.service_id}`} className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-neutral-900/90 shadow-lg sm:rounded-2xl">
              <OfferCover key={offer.cover_url || ''} url={offer.cover_url} name={offer.shop_name} />
              <div className="flex min-w-0 flex-1 flex-col p-2.5 sm:p-4">
                <p className="break-words text-xs text-neutral-400">{offer.district}</p>
                <h3 className="mt-1 break-words text-sm font-black sm:text-xl">{offer.shop_name}</h3>
                <p className="mt-1 break-words text-xs text-neutral-300 sm:text-base">{offer.service_name}</p>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="whitespace-nowrap text-xs text-neutral-400 line-through">S/ {Number(offer.regular_price).toFixed(2)}</span>
                  <span className="whitespace-nowrap text-base font-black text-amber-300 sm:text-2xl">S/ {Number(offer.promo_price).toFixed(2)}</span>
                  <span className="whitespace-nowrap text-xs text-neutral-400">{offer.duration_min} min</span>
                </div>
                <p className="mb-3 mt-2 text-xs text-neutral-400">Vigencia: {dateLabel(offer.starts_on)}–{dateLabel(offer.ends_on)}<br />{hour ? <>{singleHour ? 'Hora única: ' : `Próximo turno: ${dateLabel(first.date)} · `}<span className="whitespace-nowrap">{hour}</span></> : 'Turnos disponibles'}</p>
                <button type="button" onClick={() => onOpenOffer(offer)} className="mt-auto min-h-11 w-full rounded-xl bg-amber-300 px-2 py-2 text-sm font-bold text-black transition hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200">Ver horarios</button>
              </div>
            </article>;
          })}
        </div>
      </section>
    </main>
    {BottomNav && <BottomNav active="explore" onNavigate={onNavigate} />}
  </div>;
}
