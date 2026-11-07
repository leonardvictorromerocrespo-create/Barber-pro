import MeryoLogo from './MeryoLogo';
import {MeryoThemeToggle} from './MeryoHeader';

export function BeautyPromotions({offers,loading,error,notice='',onRetry,onBack,onReserve,onNavigate,BottomNav,themeMode='light',onToggleTheme}){
  return <div data-meryo-theme="beauty" data-meryo-mode={themeMode} className="meryo-beauty-promotions-page min-h-screen overflow-x-hidden bg-[#FAF7F4] pb-24 text-[#352832] md:pb-8">
    <header className="meryo-beauty-promotions-header sticky top-0 z-20 border-b border-[#C5AD86]/30 bg-[#FFFEFC]/95 px-4 py-3 backdrop-blur sm:px-6">
      <div className="mx-auto flex w-full min-w-0 max-w-5xl items-center justify-between gap-2 sm:gap-4">
        <MeryoLogo variant={themeMode==='light'?'light':'dark'} className="h-6 w-auto min-w-0 shrink sm:h-9" />
        <div className="flex shrink-0 items-center gap-2"><MeryoThemeToggle mode={themeMode} onToggle={onToggleTheme} className="meryo-promotion-theme-toggle"/><button type="button" onClick={onBack} className="min-h-11 shrink-0 whitespace-nowrap rounded-xl border border-[#C5AD86] px-2 py-2 text-xs font-semibold text-[#352832] sm:px-4 sm:text-sm"><span className="sm:hidden">Volver</span><span className="hidden sm:inline">Volver a Belleza</span></button></div>
      </div>
    </header>
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-8">
      <section aria-labelledby="beauty-promotions-title" className="meryo-beauty-promotions-banner relative isolate flex min-h-64 items-center overflow-hidden rounded-3xl border border-[#C5AD86]/45 bg-[#EEDDE2] px-5 py-7 sm:min-h-80 sm:px-10">
        <h1 id="beauty-promotions-title" className="meryo-beauty-promotions-title relative z-10 text-[#352832]">Promociones de peluquerías y salones</h1>
      </section>
      <section aria-label="Promociones de hoy" className="space-y-4">
        {loading&&<p role="status" className="rounded-2xl border border-[#C5AD86]/35 bg-[#FFFEFC] p-5 text-[#352832]">Buscando promociones disponibles para hoy…</p>}
        {error&&<div role="alert" className="rounded-2xl border border-[#955568]/30 bg-[#FFFEFC] p-5"><p>No pudimos cargar las promociones: {error}</p><button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded-xl bg-[#955568] px-4 py-2 font-semibold text-white">Reintentar</button></div>}
        {notice&&!error&&<p role="status" className="rounded-2xl border border-[#C5AD86]/35 bg-[#FFFEFC] p-4 text-sm">{notice}</p>}
        {!loading&&!error&&offers.length===0&&<p role="status" className="meryo-beauty-promo-status rounded-2xl border border-[#C5AD86]/35 bg-[#FFFEFC] p-5 text-[#352832]">Hoy no hay promociones disponibles</p>}
        {!loading&&!error&&offers.map(offer=><article key={`${offer.promotion_id}-${offer.shop_id}-${offer.service_id}`} className="meryo-beauty-promo-card rounded-2xl border border-[#C5AD86]/40 bg-[#FFFEFC] p-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-5">
          <div className="min-w-0"><h2 className="break-words text-xl font-bold text-[#352832] sm:text-2xl">{offer.shop_name}</h2><p className="mt-1 text-[#6B5866]">{offer.service_name}</p><div className="mt-3 flex flex-wrap items-baseline gap-3"><span className="text-sm text-[#6B5866] line-through">S/ {Number(offer.regular_price).toFixed(2)}</span><span className="text-2xl font-black text-[#955568]">S/ {Number(offer.promo_price).toFixed(2)}</span></div></div>
          <button type="button" onClick={()=>onReserve(offer)} className="mt-4 min-h-12 w-full rounded-xl bg-[#955568] px-6 py-3 font-bold text-white transition hover:bg-[#7F4658] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#352832] sm:mt-0 sm:w-auto">Reservar</button>
        </article>)}
      </section>
    </main>
    {BottomNav&&<BottomNav active="explore" onNavigate={onNavigate}/>}
  </div>;
}
