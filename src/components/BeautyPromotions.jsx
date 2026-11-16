import {useState} from 'react';
import MeryoLogo from './MeryoLogo';
import {MeryoThemeToggle} from './MeryoHeader';

function dateLabel(value){
  if(!value)return '';
  return new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',day:'numeric',month:'short'}).format(new Date(`${value}T12:00:00-05:00`));
}
function timeLabel(slot){
  const match=/^(\d{1,2}):(\d{2})$/.exec(slot?.label??'');
  if(!match)return slot?.label??'';
  const hour=Number(match[1]);
  return `${hour%12||12}:${match[2]} ${hour<12?'a. m.':'p. m.'}`;
}
function OfferCover({url,name}){
  const [failed,setFailed]=useState(false);
  return <div className="aspect-[4/3] bg-[var(--beauty-card)]">
    {url&&!failed?<img src={url} alt={`Portada de ${name}`} loading="lazy" onError={()=>setFailed(true)} className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center px-2 text-center text-xs text-[var(--beauty-muted)]">Sin portada</div>}
  </div>;
}

export function BeautyPromotions({offers,loading,error,notice='',onRetry,onBack,onReserve,onNavigate,BottomNav,themeMode='light',themeAppearance,onToggleTheme}){
  return <div data-meryo-theme="beauty" data-meryo-mode={themeMode} data-meryo-appearance={themeAppearance} className="meryo-beauty-promotions-page min-h-screen overflow-x-hidden bg-[var(--beauty-page)] pb-24 text-[var(--beauty-text)] md:pb-8">
    <header className="meryo-beauty-promotions-header sticky top-0 z-20 border-b px-4 py-3 backdrop-blur sm:px-6">
      <div className="mx-auto flex w-full min-w-0 max-w-5xl items-center justify-between gap-2 sm:gap-4">
        <MeryoLogo variant={themeMode==='light'?'light':'dark'} className="h-6 w-auto min-w-0 shrink sm:h-9" />
        <div className="flex shrink-0 items-center gap-2"><MeryoThemeToggle mode={themeMode} onToggle={onToggleTheme} className="meryo-promotion-theme-toggle"/><button type="button" onClick={onBack} className="min-h-11 shrink-0 whitespace-nowrap rounded-xl border px-2 py-2 text-xs font-semibold sm:px-4 sm:text-sm"><span className="sm:hidden">Volver</span><span className="hidden sm:inline">Volver a Peluquería</span></button></div>
      </div>
    </header>
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-8">
      <section aria-labelledby="beauty-promotions-title" className="meryo-beauty-promotions-banner relative isolate flex min-h-64 items-center overflow-hidden rounded-3xl border px-5 py-7 sm:min-h-80 sm:px-10">
        <h1 id="beauty-promotions-title" className="meryo-beauty-promotions-title relative z-10">Promociones de peluquerías y salones</h1>
      </section>
      <section aria-label="Promociones de hoy">
        {loading&&<p role="status" className="rounded-2xl border bg-[var(--beauty-surface)] p-5">Buscando promociones disponibles para hoy…</p>}
        {error&&<div role="alert" className="rounded-2xl border bg-[var(--beauty-surface)] p-5"><p>No pudimos cargar las promociones: {error}</p><button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded-xl bg-[var(--beauty-accent)] px-4 py-2 font-semibold text-[var(--beauty-accent-text)]">Reintentar</button></div>}
        {notice&&!error&&<p role="status" className="mb-4 rounded-2xl border bg-[var(--beauty-surface)] p-4 text-sm">{notice}</p>}
        {!loading&&!error&&offers.length===0&&<p role="status" className="meryo-beauty-promo-status rounded-2xl border bg-[var(--beauty-surface)] p-5">Hoy no hay promociones disponibles</p>}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-5 lg:grid-cols-3">
          {!loading&&!error&&offers.map(offer=>{
            const slots=offer.slots??[];
            const first=slots[0];
            const hour=timeLabel(first);
            const singleHour=Boolean(hour)&&slots.every(slot=>timeLabel(slot)===hour);
            return <article key={`${offer.promotion_id}-${offer.shop_id}-${offer.service_id}`} className="meryo-beauty-promo-card flex min-w-0 flex-col overflow-hidden rounded-xl border bg-[var(--beauty-surface)] shadow-sm sm:rounded-2xl">
              <OfferCover key={offer.cover_url||''} url={offer.cover_url} name={offer.shop_name}/>
              <div className="flex min-w-0 flex-1 flex-col p-2.5 sm:p-4">
                <h2 className="break-words text-sm font-black sm:text-xl">{offer.shop_name}</h2>
                <p className="mt-1 break-words text-xs text-[var(--beauty-muted)] sm:text-base">{offer.service_name}</p>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1"><span className="whitespace-nowrap text-xs text-[var(--beauty-muted)] line-through">S/ {Number(offer.regular_price).toFixed(2)}</span><span className="whitespace-nowrap text-base font-black text-[var(--beauty-accent)] sm:text-2xl">S/ {Number(offer.promo_price).toFixed(2)}</span></div>
                <p className="mb-3 mt-2 text-xs text-[var(--beauty-muted)]">{offer.duration_min?`${offer.duration_min} min · `:''}{hour?<>{singleHour?'Hora única: ':`Próximo turno: ${dateLabel(first.date)} · `}<span className="whitespace-nowrap">{hour}</span></>:'Turnos disponibles'}</p>
                <button type="button" onClick={()=>onReserve(offer)} className="meryo-beauty-promo-action mt-auto min-h-11 w-full rounded-xl px-2 py-2 text-sm font-bold">Reservar</button>
              </div>
            </article>;
          })}
        </div>
      </section>
    </main>
    {BottomNav&&<BottomNav active="explore" onNavigate={onNavigate}/>}
  </div>;
}
