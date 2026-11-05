import MeryoLogo from './MeryoLogo';
import './CutPromotions.css';

function dateLabel(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00-05:00`);
  return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'short' }).format(date);
}

export function CutPromotions({ offers, loading, error, notice='', onRetry, onBack, onOpenOffer, onNavigate, heroImage, bannerImage='/cut-promotions-banner.png', BottomNav }) {
  const hasLiveOffers=!loading&&!error&&offers.length>0;
  return <div data-meryo-theme="barberia" className="min-h-screen bg-neutral-950 pb-24 text-white md:pb-8">
    <header className="sticky top-0 z-20 border-b border-white/10 bg-neutral-950/95 px-4 py-3 backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <MeryoLogo variant="dark" className="h-7 w-auto sm:h-9" />
        <button type="button" onClick={onBack} className="min-h-11 rounded-xl border border-white/20 px-4 py-2 text-sm">Inicio</button>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
      <section className="meryo-promotions-banner relative isolate flex min-h-60 items-center overflow-hidden rounded-3xl border border-amber-400/20 bg-neutral-900 px-6 py-8 sm:min-h-80 sm:px-10" style={{ '--meryo-promotion-banner': `url("${bannerImage}")` }}>
        <div className="meryo-promotions-banner__copy">
          <p className="text-xs font-bold uppercase tracking-[.28em] text-amber-300">MERYO · promociones</p>
          <h1 className="mt-3 text-4xl font-black leading-tight text-white sm:text-6xl" style={{ textShadow: '0 0 18px rgba(232,199,102,.32)' }}>{hasLiveOffers?'Cortes al 50 %':'Promociones de barbería'}</h1>
          <p className="mt-3 text-base font-semibold text-amber-200 sm:text-xl">{hasLiveOffers?'En barberías y horarios participantes':'Consulta las ofertas disponibles'}</p>
        </div>
      </section>

      <section className="mt-7" aria-labelledby="cut-promotions-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div><h2 id="cut-promotions-heading" className="text-2xl font-black sm:text-3xl">Promociones disponibles</h2><p className="mt-1 text-sm text-neutral-400">Precios y horarios confirmados por el servidor.</p></div>
          {error && <button type="button" onClick={onRetry} className="min-h-11 rounded-xl border border-amber-400/50 px-4 text-sm font-semibold text-amber-200">Reintentar</button>}
        </div>
        {loading && <p role="status" className="rounded-2xl border border-white/10 bg-neutral-900 p-6 text-neutral-300">Buscando turnos promocionales…</p>}
        {error && <p role="alert" className="mb-4 rounded-2xl border border-red-400/30 bg-red-950/30 p-4 text-red-200">No pudimos cargar las promociones: {error}</p>}
        {notice && <p role="status" className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-amber-100">{notice}</p>}
        {!loading && !error && offers.length === 0 && <p role="status" className="rounded-2xl border border-white/10 bg-neutral-900 p-6 text-neutral-300">No hay promociones disponibles ahora.</p>}
        <div className="space-y-4">
          {!loading && offers.map(offer => {
            const first = offer.slots?.[0];
            return <article key={`${offer.campaign_id}-${offer.service_id}`} className="grid overflow-hidden rounded-3xl border border-white/10 bg-neutral-900/90 shadow-lg md:grid-cols-[minmax(220px,.75fr)_1.25fr]">
              <div className="min-h-48 bg-neutral-800 md:min-h-64">
                <img src={offer.cover_url || heroImage} alt={offer.cover_url ? `Portada de ${offer.shop_name}` : 'Barbería participante'} loading="lazy" className="h-full min-h-48 w-full object-cover md:min-h-64" />
              </div>
              <div className="flex min-w-0 flex-col p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0"><p className="text-sm text-neutral-400">{offer.district}</p><h3 className="mt-1 text-2xl font-black">{offer.shop_name}</h3><p className="mt-1 text-lg text-neutral-300">{offer.service_name}</p></div>
                  <span className="rounded-xl bg-amber-300 px-3 py-2 text-lg font-black text-black">−50 %</span>
                </div>
                <div className="mt-4 flex flex-wrap items-baseline gap-3"><span className="text-lg text-neutral-400 line-through">S/ {Number(offer.regular_price).toFixed(2)}</span><span className="text-4xl font-black text-amber-300">S/ {Number(offer.promo_price).toFixed(2)}</span><span className="text-sm text-neutral-400">{offer.duration_min} min</span></div>
                <p className="mt-3 text-sm text-neutral-300">50 % de descuento en servicios de corte participantes durante los horarios indicados. No incluye barba sola, tintes ni paquetes.</p>
                <p className="mt-2 text-sm text-neutral-400">Vigencia: {dateLabel(offer.starts_on)}–{dateLabel(offer.ends_on)} · {first ? `Próximo turno: ${dateLabel(first.date)} · ${first.label}` : 'Turnos disponibles'}</p>
                <button type="button" onClick={() => onOpenOffer(offer)} className="mt-5 min-h-12 w-full rounded-xl bg-amber-300 px-5 py-3 font-bold text-black transition hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200">Ver horarios</button>
              </div>
            </article>;
          })}
        </div>
      </section>
    </main>
    {BottomNav && <BottomNav active="explore" onNavigate={onNavigate} />}
  </div>;
}
