import PushCenter from './components/PushCenter';
import PublicShopLocation from './components/PublicShopLocation';
import NotificationAccess from './components/NotificationAccess';
import CatalogShopGrid from './components/CatalogShopGrid';
import ShopRegistration from './components/ShopRegistration';
import {visiblePolling} from './lib/visible-polling';
import { endSession, signInWithProfile } from "./lib/operations";
import { supabase, googleAuthEnabled, emailSignupEnabled } from "./lib/supabase";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createMeryoApi } from './lib/meryo-api';
import { PROFILE_PHOTO_TITLE } from './lib/shop-content';
import MeryoLogo from './components/MeryoLogo';
import { useIdentity } from './lib/useIdentity';
import Reservations from './components/Reservations';
import AdminMfa from './components/AdminMfa';
import AdminShops from './components/AdminShops';
import TeamInvite from './components/TeamInvite';
import {disableBookingPush} from './lib/push';
import {saveDraft,readDraft,clearDraft,beginGoogle} from './lib/booking-draft';
import {rememberAccess,consumeAccess,accessView,oauthFailure} from './lib/access-navigation';
import {bookingDestination,bookingIdFromSearch,pickupOrderIdFromSearch} from './lib/booking-link';
import ShopManagement from './components/management/ShopManagement';
import {clearPickupCart,readPickupCart} from './lib/pickup-cart';
import LandingPage from './components/LandingPage';
import {CutPromotions} from './components/CutPromotions';
import {markLandingIntroSeen} from './lib/landing-intro';
import beautySalonStyling from './assets/beauty-carousel/salon-styling.webp';
import beautySalonBlowdry from './assets/beauty-carousel/salon-blowdry.webp';
import beautySalonManicure from './assets/beauty-carousel/salon-manicure.webp';
import beautySalonColor from './assets/beauty-carousel/salon-color.webp';
import {catalogCountLabel} from './lib/catalog-copy';
import {createCatalogLoader} from './lib/catalog-loader';
import {isPublicShopIndexable,isPublicShopPath,publicShopCanonical,publicShopIdFromPath,publicShopUrl} from './lib/public-shop-url.js';
const api = createMeryoApi(supabase);
import CatalogFilters from "./components/CatalogFilters";
import CatalogStatus from './components/CatalogStatus';
import { selectShops, catalogMarkers, coordinates } from "./lib/catalog";
import { listaDias,sumarDias } from "./lib/dates";
const CatalogMap = lazy(() => import("./components/CatalogMap"));
const StoreModal=lazy(()=>import('./components/store/StoreModal'));
const MyPickupOrders=lazy(()=>import('./components/store/MyPickupOrders'));

const pointerClass = "cursor-pointer";
const ALLOWED_VIEWS=['landing','client','promotions','client-auth','client-register','client-login','barber','barber-login','admin','account','account-security','shop-manage','shop-register','my-bookings','my-orders','team-invite','notifications'];

export function MobileBottomNav({active,onNavigate}) {
  const items=[
    {id:'landing',label:'Inicio',path:'M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5z M9 21v-8h6v8'},
    {id:'explore',label:'Explorar',path:'m20.5 20.5-4.4-4.4 M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0z'},
    {id:'my-bookings',label:'Mis citas',path:'M5 4.5h14A2 2 0 0 1 21 6.5v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z M7 2.5v4 M17 2.5v4 M3 9h18 M7.5 13h3 M7.5 17h3'},
    {id:'account',label:'Cuenta',path:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0'},
  ];
  return <nav className="meryo-mobile-bottom-nav md:hidden" aria-label="Navegación principal">{items.map(item=><button key={item.id} type="button" aria-current={active===item.id?'page':undefined} className={active===item.id?'is-active':''} onClick={()=>onNavigate(item.id)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={item.path}/></svg><span>{item.label}</span></button>)}</nav>;
}

function upsertMeta(selector,attribute,value){
  let node=document.head.querySelector(selector);
  if(!node){node=document.createElement('meta');document.head.appendChild(node);}
  node.setAttribute(attribute,value);
}

const AVAILABLE_DATES = listaDias(3);
const BARBER_HERO_IMAGES = [
  "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1600&q=80",
];
// Licensed under the Unsplash License; salon styling, blow-dry, manicure and hair-color scenes.
const BEAUTY_HERO_IMAGES = [beautySalonStyling, beautySalonBlowdry, beautySalonManicure, beautySalonColor];

function ClientHero({ heroIndex, setHeroIndex, setView, catalogCategory='barberia' }) {
  const isBeauty=catalogCategory==='belleza';
  const heroImages=isBeauty?BEAUTY_HERO_IMAGES:BARBER_HERO_IMAGES;
  const safeIndex=heroIndex%heroImages.length;
  return (
    <>
      <div className={`meryo-beauty-hero mb-10 overflow-hidden rounded-3xl border border-white/10 bg-black`}>
        <div className="relative h-72 w-full">
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-1000"
            style={{ backgroundImage: `url(${heroImages[safeIndex]})` }}
          />
          <div className={`absolute inset-0 ${isBeauty?'meryo-beauty-hero-overlay':'bg-black/60'}`} />
          <div className="absolute bottom-4 right-4 z-20 flex gap-2">
            {heroImages.map((_, index) => (
              <button
                key={index}
                onClick={() => setHeroIndex(index)}
                aria-label={`Ver imagen ${index+1} de ${isBeauty?'peluquerías y salones':'barberías'}`}
                aria-pressed={safeIndex===index}
                className={`h-2.5 w-8 rounded-full transition ${pointerClass} ${
                  safeIndex === index ? "bg-amber-400" : "bg-white/40"
                }`}
              />
            ))}
          </div>
          <div className="relative z-10 flex h-full flex-col justify-center px-8">
            <h1 className="text-3xl font-extrabold tracking-wide text-white md:text-5xl">
              {isBeauty?'TU BELLEZA, TU ESTILO':'EL ESTILO NO SE IMPROVISA'}
            </h1>
            <p className="mt-3 max-w-xl text-sm text-neutral-300 md:text-base">
              {isBeauty?'Descubre peluquerías y salones de belleza. Conoce sus servicios y solicita tu cita.':'Descubre barberías cerca de ti. Mira sus trabajos, conoce su estilo y solicita tu cita.'}
            </p>
            <div className="mt-4 text-xs uppercase tracking-widest text-amber-400">
              MERYO • Reserva inteligente
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setView("barber")}
                className={`rounded-xl border border-white/20 bg-black/30 px-4 py-2 text-sm font-bold ${pointerClass}`}
              >
                Soy profesional
              </button>
            </div>
          </div>
        </div>
      </div>

    </>
  );
}

function ProfileSectionTitle({children}) {
  return <h4 className="border-b border-amber-400/40 pb-2 text-lg font-bold text-amber-300">{children}</h4>;
}

export function ProfileModal({ selectedShop, onClose, onReserve,onStore, catalogCategory='barberia' }) {
  const [shareFeedback,setShareFeedback]=useState('');
  if (!selectedShop) return null;
  const photos = selectedShop.assets?.filter(a => a.kind === 'foto' && a.url && a.title !== PROFILE_PHOTO_TITLE) ?? [];
  const videos = selectedShop.assets?.filter(a => a.kind === 'video' && a.url) ?? [];
  const services = selectedShop.services ?? [];
  const team = selectedShop.equipo ?? [];
  const reviews = selectedShop.resenas ?? [];
  const hasVideo = Boolean(videos.length || selectedShop.contentError);
  const hasBookableService=services.some(service=>service.bookable);
  const profileLabel=selectedShop.businessTypes?.includes('belleza')?'salón':'barbería';
  const cover=selectedShop.coverImage||selectedShop.image||'';
  const initials=selectedShop.name.trim().split(/\s+/).slice(0,2).map(part=>Array.from(part)[0]||'').join('').toLocaleUpperCase('es');
  const profileUrl=publicShopUrl(selectedShop,catalogCategory,typeof window==='undefined'?undefined:window.location.origin);
  const shareProfile=async()=>{
    setShareFeedback('');
    try {
      if(navigator.share){await navigator.share({title:selectedShop.name,text:`Mira el perfil de ${selectedShop.name} en MERYO`,url:profileUrl});setShareFeedback('Perfil compartido.');return;}
      if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(profileUrl);setShareFeedback('Enlace del perfil copiado.');return;}
      setShareFeedback('Copia este enlace:');
    } catch(error) {if(error?.name!=='AbortError')setShareFeedback('No se pudo compartir. Puedes copiar el enlace del perfil.');}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4">
      <div data-meryo-theme={catalogCategory==='belleza'?'beauty':'barberia'} className="max-h-[92vh] min-w-0 overflow-auto rounded-2xl border border-white/10 bg-neutral-950 p-2 text-white shadow-2xl sm:rounded-[2rem] sm:p-5" style={{width:'calc(100vw - 1rem)',maxWidth:'72rem',boxSizing:'border-box',overflowX:'hidden',overflowY:'auto',backgroundImage:`linear-gradient(${catalogCategory==='belleza'?'rgba(250,247,244,.90),rgba(250,247,244,.94)':'rgba(10,10,10,.92),rgba(10,10,10,.95)'}),url("${(catalogCategory==='belleza'?BEAUTY_HERO_IMAGES:BARBER_HERO_IMAGES)[0]}")`,backgroundSize:'cover',backgroundPosition:'center'}}>
        <header className="relative min-w-0">
          {cover?<img src={cover} alt={`Portada de ${selectedShop.name}`} className="h-28 w-full rounded-xl object-cover object-center sm:h-56 sm:rounded-2xl"/>:<div className="flex h-28 items-center justify-center rounded-xl border border-white/10 bg-black/30 sm:h-56 sm:rounded-2xl"><MeryoLogo className="h-8 w-auto object-contain sm:h-12"/></div>}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-2 sm:p-3"><MeryoLogo className="h-5 w-auto object-contain drop-shadow sm:h-7"/><button onClick={onClose} className={`min-h-11 rounded-lg border border-white/30 bg-black/70 px-3 py-1.5 text-xs font-semibold text-white ${pointerClass}`}>Cerrar</button></div>
          <div className="flex min-w-0 items-center gap-2 px-1 pb-2 pt-2 sm:gap-4 sm:px-3 sm:pb-4 sm:pt-3">
            <div className="-mt-8 flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-amber-300 bg-neutral-900 text-lg font-bold text-amber-200 sm:-mt-12 sm:h-24 sm:w-24 sm:text-3xl">{selectedShop.profileImage?<img src={selectedShop.profileImage} alt={`Foto de ${selectedShop.name}`} className="h-full w-full object-cover"/>:initials}</div>
            <div className="min-w-0 flex-1"><h3 className="break-words text-lg font-black leading-tight sm:text-3xl">{selectedShop.name}</h3>{selectedShop.about&&<p className="mt-1 line-clamp-3 text-xs leading-snug text-neutral-300 sm:mt-2 sm:text-base sm:leading-relaxed">{selectedShop.about}</p>}</div>
          </div>
        </header>
        <div className="grid min-w-0 grid-cols-2 items-start gap-2 sm:gap-4" style={{width:'100%',maxWidth:'100%',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)'}}>
          <div className="min-w-0 space-y-2 sm:space-y-4">
            <section className="min-w-0 rounded-xl border border-white/10 bg-black/40 p-2 sm:rounded-2xl sm:p-4"><div className="grid gap-2 sm:grid-cols-2"><button disabled={!hasBookableService} title={hasBookableService?'Reservar cita':'Aún no hay servicios con precio final y duración definidos'} onClick={onReserve} className={`min-h-11 rounded-xl bg-amber-400 px-2 py-2 text-xs font-bold leading-tight text-black disabled:cursor-not-allowed disabled:opacity-50 sm:text-base ${pointerClass}`}>Reservar cita</button><button onClick={()=>onStore(selectedShop)} className={`min-h-11 rounded-xl border border-amber-400/60 px-2 py-2 text-xs font-bold text-amber-200 sm:text-base ${pointerClass}`}>Tienda</button></div></section>
            <section className="min-w-0 rounded-xl border border-white/10 bg-black/40 p-2 sm:rounded-2xl sm:p-4"><button onClick={shareProfile} className={`min-h-11 w-full rounded-lg border border-amber-400/50 px-2 py-2 text-xs font-semibold text-amber-200 sm:text-sm ${pointerClass}`}>Compartir perfil</button>{shareFeedback&&<p aria-live="polite" className="mt-2 break-words text-xs text-neutral-300">{shareFeedback}{shareFeedback.startsWith('Copia')&&<> <a className="break-all text-amber-300 underline" href={profileUrl}>{profileUrl}</a></>}</p>}</section>
            {team.length>0&&<section className="min-w-0 rounded-xl border border-white/10 bg-black/40 p-2 sm:rounded-2xl sm:p-4"><ProfileSectionTitle>Equipo</ProfileSectionTitle><div className="mt-2 space-y-2">{team.map((p,i)=><p key={i} className="break-words text-xs text-neutral-300 sm:text-sm">{p.nombre}{p.propietario?' · propietario':''}</p>)}</div></section>}
            {services.length>0&&<section className="min-w-0 rounded-xl border border-white/10 bg-black/40 p-2 sm:rounded-2xl sm:p-4"><ProfileSectionTitle>Servicios</ProfileSectionTitle><div className="mt-2 space-y-2">{services.map(service=><div key={service.id} className="min-w-0 rounded-lg border border-white/10 bg-black/30 p-2 text-xs sm:rounded-xl sm:p-3 sm:text-sm"><p className="break-words font-semibold text-white">{service.name}</p><p className="mt-1 text-[10px] text-neutral-400 sm:text-xs">{service.duration||'Duración por definir'}</p>{service.bookable?<p className="mt-1 text-amber-400">S/ {service.price}</p>:<p className="mt-1 text-[10px] leading-snug text-amber-300 sm:text-xs">Requiere evaluación · precio final y duración por confirmar</p>}</div>)}</div></section>}
          </div>
          <div className="min-w-0 space-y-2 sm:space-y-4">
            <PublicShopLocation key={selectedShop.id} shop={selectedShop} mapHeight="h-24 sm:h-44" className="mt-0"/>
            {hasVideo&&<section className="min-w-0 rounded-xl border border-white/10 bg-black/40 p-2 sm:rounded-2xl sm:p-4"><ProfileSectionTitle>Video</ProfileSectionTitle>{videos.map(a=><video key={a.id} src={a.url} controls preload="metadata" aria-label="Video de presentación" className="mt-2 max-h-80 w-full rounded-lg"/>)}{selectedShop.contentError&&<p role="alert" className="mt-2 text-xs text-amber-300 sm:text-sm">{selectedShop.contentError}</p>}</section>}
            {photos.length>0&&<section className="min-w-0 rounded-xl border border-white/10 bg-black/40 p-2 sm:rounded-2xl sm:p-4"><ProfileSectionTitle>Portafolio</ProfileSectionTitle><div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">{photos.map(a=><figure key={a.id} className="min-w-0"><img src={a.url} alt={a.title||`Trabajo publicado por el ${profileLabel}`} className="h-24 w-full rounded-lg object-cover sm:h-48 sm:rounded-xl"/>{a.title&&<figcaption className="mt-1 break-words text-[10px] text-neutral-300 sm:text-xs">{a.title}</figcaption>}</figure>)}</div></section>}
            {(selectedShop.reviews>0||reviews.length>0)&&<section className="min-w-0 rounded-xl border border-white/10 bg-black/40 p-2 sm:rounded-2xl sm:p-4"><ProfileSectionTitle>Reseñas</ProfileSectionTitle>{selectedShop.reviews>0&&<p className="mt-2 text-xs text-neutral-300 sm:text-sm">⭐ {selectedShop.rating} basado en {selectedShop.reviews} reseñas</p>}{reviews.map(r=><article key={r.id} className="mt-2 border-t border-white/10 pt-2"><p className="text-xs">{r.autor} · {r.calificacion}/5</p><p className="mt-1 break-words text-xs text-neutral-300">{r.comentario}</p></article>)}</section>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BookingModal({
  catalogCategory='barberia',
  selectedShop,
  selectedService,
  setSelectedService,
  selectedBarber,setSelectedBarber,
  selectedDate,
  setSelectedDate,
  selectedTime,
  setSelectedTime,
  customerInfo,
  setCustomerInfo,
  customRequest,
  setCustomRequest,
  activeSlots,
  finalPrice,
  requestSaved,
  submitReservation,
  closeBookingModal,
  savingReservation,
  reservationsEnabled,
  agendaLoading,agendaError,onLogin,accessMessage,
  identityLoading=false,identityError='',onRetrySession,promotion=null,promotionError='',onRegularPrice,onBackToOffers,
}) {
  if (!selectedShop) return null;
  const eligible=(selectedShop.equipo??[]).filter(m=>m.servicios?.some(id=>String(id)===String(selectedService?.id)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      
      <div data-meryo-theme={catalogCategory==='belleza'?'beauty':'barberia'} className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-[2rem] border border-white/10 bg-neutral-950 p-6 text-white shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-amber-300">Reserva tu cita</p>
            <h3 className="mt-2 text-3xl font-black">{selectedShop.name}</h3>{accessMessage&&<p role="status" className="mt-3 text-amber-300">{accessMessage}</p>}
            <p className="mt-2 text-neutral-400">
              Elige el servicio y solicita un horario. No se realiza ningún cobro en esta pantalla.
            </p>
          </div>
          <button onClick={closeBookingModal} className={`rounded-xl border border-white/10 px-4 py-2 text-sm ${pointerClass}`}>
            Cerrar
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-neutral-900 p-5">
              <h4 className="text-xl font-bold">1. {promotion?'Servicio participante y barbero':'Elige tu servicio y barbero'}</h4><label className="mt-3 block text-sm">Barbero<select aria-label="Barbero" className="mt-2 block w-full rounded-xl border border-white/10 bg-neutral-900 p-3" value={selectedBarber||''} onChange={e=>{setSelectedBarber(e.target.value);setSelectedTime('');}}><option value="">Selecciona un barbero</option>{eligible.map(m=><option key={m.id} value={m.id}>{m.nombre}</option>)}</select></label>{!eligible.length&&<p className="mt-3 text-sm text-amber-300">Este servicio todavía no tiene un integrante habilitado.</p>}
              {promotion&&<p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-100">Corte al 50 %: precio habitual S/ {Number(promotion.regularPrice).toFixed(2)} · oferta S/ {Number(finalPrice).toFixed(2)}. El adelanto, si el barbero acepta, se calcula sobre el precio promocional.</p>}
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {(promotion?selectedShop.services.filter(service=>service.bookable&&String(service.id)===String(selectedService?.id)):selectedShop.services.filter(service=>service.bookable)).map((service) => (
                  <button
                    key={service.id}
                    onClick={() => {setSelectedService(service);setSelectedTime("");}}
                    className={`rounded-2xl border p-4 text-left transition ${pointerClass} ${
                      selectedService?.id === service.id
                        ? "border-amber-400 bg-amber-400 text-black"
                        : "border-white/10 bg-black/20 text-white"
                    }`}
                  >
                    <p className="font-bold">{service.name}</p>
                    <p className={`mt-1 text-sm ${selectedService?.id === service.id ? "text-black/80" : "text-neutral-400"}`}>
                      {service.duration}
                    </p>
                    {promotion&&<p className={`mt-3 text-sm line-through ${selectedService?.id===service.id?'text-black/65':'text-neutral-500'}`}>S/ {Number(service.price).toFixed(2)}</p>}
                    <p className={`${promotion?'mt-0':'mt-3'} text-lg font-black`}>S/ {promotion?Number(finalPrice).toFixed(2):service.price}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-neutral-900 p-5">
              <h4 className="text-xl font-bold">2. Elige la fecha</h4><label className="mt-3 block text-sm">Otra fecha (hasta 30 días)<input aria-label="Fecha de la cita" type="date" min={AVAILABLE_DATES[0]} max={sumarDias(AVAILABLE_DATES[0],30)} value={selectedDate} onChange={e=>{setSelectedDate(e.target.value);setSelectedTime("");}} className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 p-3"/></label>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {AVAILABLE_DATES.map((date) => (
                  <button
                    key={date}
                    onClick={() => {
                      setSelectedDate(date);
                      setSelectedTime("");
                    }}
                    className={`rounded-2xl border px-4 py-4 text-sm font-semibold ${pointerClass} ${
                      selectedDate === date
                        ? "border-amber-400 bg-amber-400 text-black"
                        : "border-white/10 bg-black/20 text-white"
                    }`}
                  >
                    {date}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-neutral-900 p-5">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-xl font-bold">3. Elige la hora</h4>
                <div className="flex items-center gap-4 text-xs text-neutral-400">
                  <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-white/70" /> Disponible</span>
                  <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-500" /> Ocupada</span>
                </div>
              </div>
              {agendaLoading&&<p>Cargando horarios del servidor…</p>}{agendaError&&<p role="alert" className="text-red-300">{agendaError}</p>}{!agendaLoading&&!agendaError&&!activeSlots.length&&<p>{promotion?'No quedan turnos participantes disponibles para esta fecha.':'Sin horarios disponibles para este servicio y fecha.'}</p>}
              {promotionError&&<div role="alert" className="mt-3 space-y-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100"><p>{promotionError} No se cambió el precio.</p><button type="button" onClick={onBackToOffers} className="underline underline-offset-2">Volver a promociones y revisar el precio</button></div>}
              {promotion&&!agendaLoading&&!activeSlots.length&&<button type="button" onClick={onRegularPrice} className="mt-3 min-h-11 rounded-xl border border-white/20 px-4 py-2 text-sm">Ver otros horarios al precio habitual S/ {Number(promotion.regularPrice).toFixed(2)}</button>}
              <div className="meryo-time-grid mt-4 grid grid-cols-3 gap-2 min-[390px]:grid-cols-4">
                {activeSlots.map((slot) => (
                  <button
                    key={`${selectedDate}-${slot.time}`}
                    disabled={slot.occupied}
                    onClick={() => setSelectedTime(slot.time)}
                    aria-pressed={selectedTime===slot.time}
                    aria-label={`${slot.label}${slot.occupied?' · no disponible':selectedTime===slot.time?' · seleccionado':' · disponible'}`}
                    className={`meryo-time-slot min-h-11 min-w-0 whitespace-nowrap rounded-xl border px-2 py-3 text-sm font-semibold transition ${
                      slot.occupied
                        ? "cursor-not-allowed border-red-500/40 bg-red-500 text-white opacity-80"
                        : `${pointerClass} ${selectedTime === slot.time ? "border-amber-400 bg-amber-400 text-black" : "border-white/10 bg-black/20 text-white hover:border-amber-400/50"}`
                    }`}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-neutral-900 p-5">
              <h4 className="text-xl font-bold">4. Datos del cliente</h4>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo((prev) => ({ ...prev, name: e.target.value }))}
                  className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
                  placeholder="Tu nombre"
                />
                <input
                  value={customerInfo.phone}
                  onChange={(e) => setCustomerInfo((prev) => ({ ...prev, phone: e.target.value }))}
                  className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
                  placeholder="Tu celular"
                />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-neutral-900 p-5">
              <h4 className="text-xl font-bold">5. Pedido especial (opcional)</h4>
              <p className="mt-2 text-sm text-neutral-400">Si deseas un estilo distinto puedes explicarlo al barbero.</p>
              <textarea
                value={customRequest}
                onChange={(e) => setCustomRequest(e.target.value)}
                placeholder="Ej: degradado alto con línea al costado, barba marcada o cejas suaves"
                className="mt-3 min-h-[110px] w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
              />

            </div>


          </div>

          <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5">
            <p className="text-sm uppercase tracking-[0.2em] text-amber-300">Resumen</p>
            <h4 className="mt-2 text-2xl font-black">{selectedShop.name}</h4>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between"><span>Cliente</span><span>{customerInfo.name || "-"}</span></div>
              <div className="flex justify-between"><span>Servicio</span><span>{selectedService?.name || "-"}</span></div>
              <div className="flex justify-between"><span>Barbero</span><span>{eligible.find(m=>m.id===selectedBarber)?.nombre||'Selecciona un barbero'}</span></div>
              <div className="flex justify-between"><span>Fecha</span><span>{selectedDate}</span></div>
              <div className="flex justify-between"><span>Hora</span><span>{activeSlots.find(slot=>slot.time===selectedTime)?.label || "Selecciona una hora"}</span></div>
              <div className="flex justify-between"><span>Pedido especial</span><span className="max-w-[170px] text-right">{customRequest || "No"}</span></div>
              {promotion&&<div className="flex justify-between"><span>Precio habitual</span><span className="line-through">S/ {Number(promotion.regularPrice).toFixed(2)}</span></div>}
              <div className="flex justify-between"><span>Adelanto tras aceptar</span><span>S/ {(finalPrice * 0.5).toFixed(2)}</span></div>
              <div className="flex justify-between text-lg font-black"><span>{promotion?'Precio promocional':'Total'}</span><span className="text-amber-300">S/ {Number(finalPrice).toFixed(2)}</span></div>
            </div>
            <p className="mt-5 text-sm text-amber-200">El barbero tendrá hasta 15 minutos para aceptar tu solicitud. Te avisaremos cuando puedas pagar el adelanto del 50 %.</p>
            <button
              onClick={submitReservation}
              disabled={savingReservation || identityLoading || !selectedTime || !selectedBarber || (reservationsEnabled&&(!customerInfo.name.trim() || !customerInfo.phone.trim())) || requestSaved}
              className={`mt-6 w-full rounded-xl py-3 font-bold ${
                selectedTime && customerInfo.name.trim() && customerInfo.phone.trim() && !requestSaved
                  ? `${pointerClass} bg-amber-400 text-black`
                  : "cursor-not-allowed bg-neutral-700 text-neutral-400"
              }`}
            >
              {requestSaved ? "Solicitud guardada" : savingReservation ? "Guardando…" : "Solicitar cita"}
            </button>
            {identityLoading&&<p role="status" className="mt-3 text-sm text-neutral-300">Restaurando tu sesión…</p>}
            {!identityLoading&&identityError&&<div className="mt-3 text-sm text-amber-300"><p>No pudimos comprobar tu sesión todavía.</p><button type="button" onClick={onRetrySession} className="mt-2 underline">Reintentar</button></div>}
            {!identityLoading&&!identityError&&!reservationsEnabled&&<div className="mt-3 text-sm text-amber-300"><p>Al solicitar, continúa con Google o con correo y contraseña. Conservaremos tu selección; no se realiza ningún cobro.</p><button onClick={onLogin} className="mt-2 underline">Iniciar sesión</button></div>}
            {requestSaved && (
              <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
                Solicitud guardada para {selectedDate} a las {activeSlots.find(slot=>slot.time===selectedTime)?.label}. Pendiente de aceptación del barbero. No se ha realizado ningún cobro.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BarberProApp() {
 const identity=useIdentity(supabase);
 return <><NotificationAccess api={api} profile={identity.profile} loading={identity.loading}/><MeryoScreens identity={identity}/></>;
}
function MeryoScreens({identity}) {
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [query, setQuery] = useState("");
  const [district, setDistrict] = useState("");
  const [order, setOrder] = useState("name");
  const [catalogCategory,setCatalogCategory]=useState(()=>new URLSearchParams(typeof window==='undefined'?'':window.location.search).get('catalogo')==='belleza'?'belleza':'barberia');
  const [loginDestination,setLoginDestination]=useState('client');
  const [view, setView] = useState(()=>{const raw=typeof window==='undefined'?'':window.location.hash.slice(1);const hash=raw.startsWith('team-invite/')?'team-invite':raw;const search=typeof window==='undefined'?'':window.location.search,access=new URLSearchParams(search).get('access');const fallback=isPublicShopPath(typeof window==='undefined'?'':window.location.pathname)?'client':ALLOWED_VIEWS.includes(hash)?hash:'landing';return bookingDestination(search,access==='barber'?'barber-login':access==='shop-register'?'shop-register':fallback);});
  const [mobileExploreRequested,setMobileExploreRequested]=useState(false);
  const [locationPath,setLocationPath]=useState(()=>typeof window==='undefined'?'':window.location.pathname);
  const initialView = useRef(view);
  useEffect(()=>{if(initialView.current!=='landing')markLandingIntroSeen();},[]);
  useEffect(()=>{const url=new URL(window.location.href);if(view==='landing'&&isPublicShopPath(url.pathname))url.pathname='/';url.hash=view;window.history.replaceState(window.history.state,'',url.href);setLocationPath(url.pathname);},[view]);
  useEffect(()=>{
    if(view!=='client'||!mobileExploreRequested)return;
    const frame=requestAnimationFrame(()=>{document.getElementById('catalogo')?.scrollIntoView({behavior:'smooth',block:'start'});setMobileExploreRequested(false);});
    return()=>cancelAnimationFrame(frame);
  },[view,mobileExploreRequested]);
  const adminAccess = identity.profile?.rol === 'admin' && identity.profile?.activo === true;
  const [adminAal2,setAdminAal2]=useState(false);
  const [adminSecurityOpen,setAdminSecurityOpen]=useState(false);
  const [accessMessage,setAccessMessage]=useState('');
  const resumed=useRef('');
  useEffect(()=>{let active=true;setAdminAal2(false);if(adminAccess)supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({data,error})=>{if(active)setAdminAal2(!error&&data?.currentLevel==='aal2');});return()=>{active=false;};},[identity.profile,adminAccess]);
  const barberLoggedIn = identity.profile?.rol === 'barbero';
  const [catalogLoadRevision,setCatalogLoadRevision]=useState(0);
  const [catalogState,setCatalogState]=useState({category:null,rows:[],loading:true,error:''});
  const [cutOffers,setCutOffers]=useState([]),[cutOffersLoading,setCutOffersLoading]=useState(false),[cutOffersError,setCutOffersError]=useState(''),[cutOffersNotice,setCutOffersNotice]=useState(''),[promotionError,setPromotionError]=useState('');
  const [activeSlots,setActiveSlots] = useState([]);
  const [agendaError,setAgendaError] = useState('');
  const [agendaLoading,setAgendaLoading] = useState(false);
  const catalogLoader=useRef(null);
  const catalogNavigation=useRef(0);
  if(!catalogLoader.current)catalogLoader.current=createCatalogLoader((category,options)=>api.catalog(category,options),setCatalogState);
  const loadedCatalogCategory=catalogState.category,shops=catalogState.rows,catalogLoading=catalogState.loading,catalogError=catalogState.error;
  const catalogMatchesCategory=loadedCatalogCategory===catalogCategory;
  const catalogRows=useMemo(()=>catalogMatchesCategory?shops:[],[catalogMatchesCategory,shops]);
  // Public RPC contract; authenticated requests stay blocked without real Auth.
  const reservationsEnabled = !identity.loading && identity.profile?.rol === 'cliente' && !supabase.authUnavailable;
  const [savingReservation, setSavingReservation] = useState(false);
  const [registerForm, setRegisterForm] = useState({ email: "", password: "" });
  const [registerBusy, setRegisterBusy] = useState(false);
  const [registerMessage, setRegisterMessage] = useState("");
  const [affiliateForm, setAffiliateForm] = useState({
    nombre: "",
    tipo_negocio: "barberia",
    distrito: "",
    whatsapp: "",
    correo: "",
    direccion: "",
  });
  const [affiliateBusy,setAffiliateBusy]=useState(false),[affiliateError,setAffiliateError]=useState('');
  const [selectedShop, setSelectedShop] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedPromotion,setSelectedPromotion]=useState(null);
  const [selectedBarber,setSelectedBarber]=useState('');
  useEffect(()=>{const eligible=(selectedShop?.equipo??[]).filter(m=>m.servicios?.some(id=>String(id)===String(selectedService?.id)));setSelectedBarber(current=>eligible.some(m=>m.id===current)?current:eligible[0]?.id||'');},[selectedShop,selectedService]);
  const [selectedDate, setSelectedDate] = useState(AVAILABLE_DATES[0]);
  const [selectedTime, setSelectedTime] = useState("");
  const [showAffiliateForm, setShowAffiliateForm] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileUnavailable,setProfileUnavailable]=useState(false);
  const profileRouteId=publicShopIdFromPath(locationPath);
  useEffect(()=>{
    if(!profileRouteId){setProfileUnavailable(false);return;}
    if(!catalogMatchesCategory||catalogLoading)return;
    const shop=catalogRows.find(row=>String(row.id)===profileRouteId);
    if(shop){setSelectedShop(shop);setShowProfileModal(true);setProfileUnavailable(false);}
    else{setSelectedShop(null);setShowProfileModal(false);setProfileUnavailable(true);}
  },[profileRouteId,catalogMatchesCategory,catalogLoading,catalogRows]);
  useEffect(()=>{
    if(profileRouteId&&!showProfileModal&&!profileUnavailable)return;
    const shop=showProfileModal?selectedShop:null;
    if(profileUnavailable){document.title='Negocio no disponible | MERYO';upsertMeta('meta[name="robots"]','content','noindex,follow');document.head.querySelector('link[rel="canonical"]')?.remove();return;}
    if(shop){
      const category=catalogCategory==='belleza'?'Peluquería y salón':'Barbería';
      const title=`${shop.name} | ${category} en MERYO`;
      const description=String(shop.about||`Conoce ${shop.name} y consulta sus servicios disponibles en MERYO.`).replace(/\s+/g,' ').trim().slice(0,180);
      const canonical=publicShopCanonical({...shop,name:shop.name},window.location.origin);
      document.title=title;upsertMeta('meta[name="description"]','content',description);upsertMeta('meta[name="robots"]','content',isPublicShopIndexable(shop)?'index,follow,max-image-preview:large':'noindex,follow');
      upsertMeta('meta[property="og:title"]','content',title);upsertMeta('meta[property="og:description"]','content',description);upsertMeta('meta[property="og:url"]','content',canonical);
      let link=document.head.querySelector('link[rel="canonical"]');if(!link){link=document.createElement('link');link.rel='canonical';document.head.appendChild(link);}link.href=canonical;
      return;
    }
    document.title='MERYO | Barberías y salones';upsertMeta('meta[name="description"]','content','Descubre barberías y salones, conoce sus servicios y solicita tu cita en MERYO.');upsertMeta('meta[name="robots"]','content','index,follow');upsertMeta('meta[property="og:title"]','content','MERYO | Barberías y salones');upsertMeta('meta[property="og:url"]','content','https://barber-pro-phi-taupe.vercel.app/');
    let link=document.head.querySelector('link[rel="canonical"]');if(!link){link=document.createElement('link');link.rel='canonical';document.head.appendChild(link);}link.href='https://barber-pro-phi-taupe.vercel.app/';
  },[profileRouteId,showProfileModal,selectedShop,catalogCategory,profileUnavailable]);
  const [showStoreModal,setShowStoreModal]=useState(false),[storeShop,setStoreShop]=useState(null),[storeCategory,setStoreCategory]=useState(catalogCategory),[restoredPickupCart,setRestoredPickupCart]=useState(null);
  const [requestSaved, setRequestSaved] = useState(false);
  const [barberLogin, setBarberLogin] = useState({ email: "", password: "" });
  const [customRequest, setCustomRequest] = useState("");
  const [customerInfo, setCustomerInfo] = useState({ name: "", phone: "" });
  const [heroIndex, setHeroIndex] = useState(0);
  const cargarBarberiasActivas = useCallback(() => catalogLoader.current.load(catalogCategory),[catalogCategory]);
  const cambiarCategoriaCatalogo = useCallback(category => {
    const next=category==='belleza'?'belleza':'barberia';
    catalogNavigation.current+=1;
    catalogLoader.current.reset(next);
    setCatalogCategory(next);
    // A navigation can select the same category after invalidating its load.
    setCatalogLoadRevision(revision=>revision+1);
  },[]);

  useEffect(()=>{
    const syncNavigation=()=>{
      const url=new URL(window.location.href),nextCategory=url.searchParams.get('catalogo')==='belleza'?'belleza':'barberia';
      const nextId=publicShopIdFromPath(url.pathname),previousId=publicShopIdFromPath(locationPath);
      if(nextCategory!==catalogCategory){setShowProfileModal(false);setSelectedShop(null);setProfileUnavailable(false);cambiarCategoriaCatalogo(nextCategory);}
      if(nextId!==previousId||!nextId){setShowProfileModal(false);setSelectedShop(null);setProfileUnavailable(false);}
      setLocationPath(url.pathname);
      const raw=url.hash.slice(1),hash=raw.startsWith('team-invite/')?'team-invite':raw;
      setView(ALLOWED_VIEWS.includes(hash)?hash:(nextId?'client':'landing'));
    };
    window.addEventListener('popstate',syncNavigation);
    window.addEventListener('hashchange',syncNavigation);
    return()=>{window.removeEventListener('popstate',syncNavigation);window.removeEventListener('hashchange',syncNavigation);};
  },[catalogCategory,cambiarCategoriaCatalogo,locationPath]);

  useEffect(() => {
    let active=true;
    if(!showBookingModal || !selectedShop || !selectedService || !selectedBarber){setActiveSlots([]);setAgendaLoading(false);return;}
    setAgendaLoading(true);setAgendaError('');setActiveSlots([]);
    const refreshSlots=()=>(selectedPromotion
      ?api.cutPromotionSlots(selectedShop.id,selectedService.id,selectedDate,selectedBarber,selectedPromotion.campaignId)
      :api.slots(selectedShop.id,selectedService.id,selectedDate,selectedBarber)).then(rows => {if(active){setActiveSlots(rows);setSelectedTime(current=>rows.some(s=>s.time===current)?current:"");}})
      .catch(error=>{if(active){setAgendaError(error.message);setActiveSlots([]);setSelectedTime('');}}).finally(()=>{if(active)setAgendaLoading(false);});
    const reader=visiblePolling(refreshSlots);
    return()=>{active=false;reader.stop();};
  },[showBookingModal,selectedShop,selectedService,selectedDate,selectedBarber,selectedPromotion]);

useEffect(() => { cargarBarberiasActivas(); }, [cargarBarberiasActivas,catalogLoadRevision]);
  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % BARBER_HERO_IMAGES.length);
    }, 6000);

    return () => clearInterval(timer);
  }, []);

  const ranking = useMemo(
    () => selectShops(catalogRows, { query, district, order, location }),
    [catalogRows, query, district, order, location]
  );

  const markers = useMemo(() => catalogMarkers(ranking), [ranking]);

  const handleAffiliateSubmit = async () => {
    if(affiliateBusy)return;setAffiliateBusy(true);setAffiliateError('');
    try {if(affiliateForm.locationConfirmed!==true||!coordinates(affiliateForm))throw Error('Selecciona o confirma la ubicación del local en el mapa.');await api.registerShop(affiliateForm);const profile=await identity.refresh();if(!profile||profile.rol!=='barbero')throw Error('La solicitud se guardó, pero no se pudo actualizar tu sesión. Vuelve a iniciar sesión para consultar su estado.');setShowAffiliateForm(false);setView('shop-manage');}
    catch(error){setAffiliateError(error.message);}
    finally{setAffiliateBusy(false);}
  };

  const openCatalogCategory = category => {
    const next=category==='belleza'?'belleza':'barberia';
    const url=new URL(window.location.href);url.pathname='/';url.search='';url.searchParams.set('catalogo',next);url.hash='client';
    window.history.replaceState({},'',url.href);setLocationPath('/');
    cambiarCategoriaCatalogo(next);setQuery('');setDistrict('');setView('client');
  };

  const loadCutOffers=useCallback(async()=>{
    setCutOffersLoading(true);setCutOffersError('');setCutOffersNotice('');
    try{setCutOffers(await api.cutPromotions());}
    catch(error){setCutOffersError(error.message);setCutOffers([]);}
    finally{setCutOffersLoading(false);}
  },[]);
  useEffect(()=>{
    if(view!=='promotions')return undefined;
    void loadCutOffers();
    const refresh=()=>{if(document.visibilityState==='visible')void loadCutOffers();};
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
    return()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[view,loadCutOffers]);

  const enableLocation = () => {
    setLocationError("");
    if (!navigator.geolocation) return setLocationError("Este navegador no permite obtener tu ubicación.");
    navigator.geolocation.getCurrentPosition(position => {
      const point = coordinates({ lat: position.coords.latitude, lng: position.coords.longitude });
      if (!point) return setLocationError("No se obtuvo una ubicación válida.");
      setLocation(point); setOrder("distance");
    }, () => setLocationError("No pudimos obtener tu ubicación. Puedes buscar por distrito."), { timeout: 10000 });
  };

  const openProfileModal = (shop) => {
    const currentId=publicShopIdFromPath(window.location.pathname);
    if(currentId!==String(shop.id)){
      const destination=new URL(publicShopUrl(shop,catalogCategory,window.location.origin));destination.hash='client';
      const previous=`${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.history.pushState({...window.history.state,meryoProfileModal:true,meryoCatalogPath:previous},'',destination.href);
      setLocationPath(destination.pathname);
    }
    setSelectedShop(shop);
    setShowProfileModal(true);
    setProfileUnavailable(false);
  };

  const closeProfileModal = () => {
    setShowProfileModal(false);setSelectedShop(null);setProfileUnavailable(false);
    if(window.history.state?.meryoProfileModal){window.history.back();return;}
    const url=new URL(window.location.href);url.pathname='/';url.search='';url.searchParams.set('catalogo',catalogCategory);url.hash='client';
    window.history.replaceState({},'',url.href);setLocationPath('/');setView('client');
  };
  const openStoreModal = shop => {setStoreShop(shop);setStoreCategory(catalogCategory);setShowProfileModal(false);setRestoredPickupCart(null);setShowStoreModal(true);};

  const openBookingModal = (shop) => {
    const service=(shop.services??[]).find(item=>item.bookable);
    if(!service){setAccessMessage('Este negocio aún no tiene servicios con precio y duración definidos para reservar. Consulta con el negocio si el servicio requiere evaluación.');return;}
    setSelectedPromotion(null);setPromotionError('');
    setSelectedShop(shop);
    setSelectedService(service);
    setSelectedDate(AVAILABLE_DATES[0]);
    setSelectedTime("");
    setCustomRequest("");
    setCustomerInfo(prev=>({...prev,name:prev.name||identity.profile?.nombre||"",phone:prev.phone||identity.profile?.telefono||""}));
    setRequestSaved(false);
    setShowBookingModal(true);
  };

  const openCutOffer=async offer=>{
    setAccessMessage('');setPromotionError('');setAgendaError('');setCutOffersError('');setCutOffersNotice('');
    try{
      // Cards can stay open while another customer books the last slot. Resolve
      // the offer again on the server before opening the existing booking flow.
      const currentOffers=await api.cutPromotions();
      setCutOffers(currentOffers);
      const currentOffer=currentOffers.find(row=>String(row.campaign_id)===String(offer.campaign_id)&&String(row.service_id)===String(offer.service_id));
      if(!currentOffer){setCutOffersNotice('Esta promoción venció o ya no tiene horarios disponibles. La lista se actualizó.');return;}
      const slot=currentOffer.slots?.[0];
      if(!slot){setCutOffersNotice('Esta promoción ya no tiene horarios reservables. La lista se actualizó.');return;}
      const catalog=await api.catalog('barberia');
      const shop=catalog.find(row=>String(row.id)===String(currentOffer.shop_id));
      const service=shop?.services.find(row=>String(row.id)===String(currentOffer.service_id)&&row.bookable);
      if(!shop||!service)throw Error('La barbería o el servicio ya no están publicados. Actualiza las promociones.');
      cambiarCategoriaCatalogo('barberia');setSelectedShop(shop);setSelectedService(service);setSelectedBarber(slot.barber_id);setSelectedDate(slot.date);setSelectedTime(slot.start);setCustomRequest('');
      setCustomerInfo(current=>({...current,name:current.name||identity.profile?.nombre||'',phone:current.phone||identity.profile?.telefono||''}));
      setSelectedPromotion({campaignId:currentOffer.campaign_id,regularPrice:Number(currentOffer.regular_price),promoPrice:Number(currentOffer.promo_price),serviceId:service.id,shopId:shop.id});
      setRequestSaved(false);setShowBookingModal(true);
    }catch(error){setCutOffersNotice(error.message||'No se pudo actualizar esta promoción. Inténtalo de nuevo.');}
  };

  const continueAtRegularPrice=()=>{
    setSelectedPromotion(null);setSelectedTime('');setPromotionError('La oferta solo aplica a sus horarios participantes. El precio habitual indicado ahora es el que se usará.');
  };

  const closeBookingModal = () => {
    setShowBookingModal(false);
    setSelectedTime("");
    setRequestSaved(false);
    setSelectedPromotion(null);setPromotionError('');
  };

  const requireBookingLogin=()=>{try{saveDraft(sessionStorage,{shop:selectedShop.id,service:selectedService.id,barber:selectedBarber,category:catalogCategory,date:selectedDate,time:selectedTime,name:customerInfo.name,phone:customerInfo.phone,note:customRequest,campaignId:selectedPromotion?.campaignId,regularPrice:selectedPromotion?.regularPrice});setShowBookingModal(false);openLogin('client');}catch(error){setAccessMessage(error.message);}};
  useEffect(()=>{
    const url=new URL(window.location.href),failure=oauthFailure(url);if(identity.loading||(!failure&&url.searchParams.get('auth_callback')!=='1'))return;
    const saved=consumeAccess(sessionStorage),access=url.searchParams.get('access'),destination=['barber','shop-register'].includes(access)?access:saved;
    for(const key of ['auth_callback','access','error','error_code','error_description'])url.searchParams.delete(key);
    window.history.replaceState(null,'',url.pathname+url.search+url.hash);
    if(failure){setAccessMessage(failure);setLoginDestination(bookingDestination(url.search,destination));setView(['barber','shop-register'].includes(destination)?'shop-register':destination==='admin'?'admin':'client-login');return;}
    if(identity.profile){setView(bookingDestination(url.search,accessView(destination,identity.profile.rol)));}
    else{setLoginDestination(bookingDestination(url.search,destination));setAccessMessage(identity.error||'Google no completó el acceso. Puedes reintentar o continuar con correo; conservaremos tu destino.');setView(['barber','shop-register'].includes(destination)?'shop-register':'client-login');}
  },[identity.loading,identity.profile]);
  const openLogin=destination=>{setLoginDestination(destination);setView('client-login');};
  const handleGoogle=async override=>{setAccessMessage('');try{const destination=typeof override==='string'?override:view==='team-invite'?'team-invite':view==='admin'?'admin':view==='shop-register'?'shop-register':['barber','barber-login'].includes(view)?'barber':view==='client-login'?loginDestination:'client';rememberAccess(sessionStorage,destination);await beginGoogle(supabase,{enabled:googleAuthEnabled,origin:window.location.origin,bookingId:new URLSearchParams(window.location.search).get('cita'),orderId:new URLSearchParams(window.location.search).get('pedido'),adminView:new URLSearchParams(window.location.search).get('admin_view'),destination});}catch(error){setAccessMessage(error.message);}};
  useEffect(()=>{if(identity.profile&&['barber','barber-login','shop-register'].includes(view)){const next=accessView(view==='shop-register'?'shop-register':'barber',identity.profile.rol);if(next!==view)setView(next);}},[identity.profile,view]);
  useEffect(()=>{
    const profile=identity.profile;if(!profile||resumed.current===profile.id)return;
    if(bookingIdFromSearch(window.location.search)){resumed.current=profile.id;setView('my-bookings');return;}
    const pickupDraft=readPickupCart(sessionStorage);
    if(pickupDraft){
      if(profile.rol!=='cliente'){clearPickupCart(sessionStorage);resumed.current=profile.id;setAccessMessage('La selección de tienda se guardó, pero esta cuenta no tiene rol de cliente. Usa una cuenta de cliente para solicitar productos.');return;}
      let active=true;const navigationAtStart=catalogNavigation.current;api.catalog(pickupDraft.category).then(catalog=>{if(!active||navigationAtStart!==catalogNavigation.current)return;const shop=catalog.find(item=>String(item.id)===pickupDraft.shop);if(!shop)throw Error('El negocio ya no está visible. Vuelve al catálogo para elegir otro.');const category=pickupDraft.category==='belleza'?'belleza':'barberia';const url=new URL(window.location.href);url.searchParams.set('catalogo',category);window.history.replaceState(null,'',url.pathname+url.search+url.hash);cambiarCategoriaCatalogo(category);setStoreCategory(category);setStoreShop(shop);setRestoredPickupCart(pickupDraft);setShowStoreModal(true);setView('client');setAccessMessage('Recuperamos tu selección de tienda. Revisa productos y cantidades antes de enviarla.');clearPickupCart(sessionStorage);resumed.current=profile.id;}).catch(error=>{if(active&&navigationAtStart===catalogNavigation.current){setAccessMessage(error.message);clearPickupCart(sessionStorage);resumed.current=profile.id;}});return()=>{active=false;};
    }
    if(['barber','barber-login','shop-register','shop-manage'].includes(view)){resumed.current=profile.id;return;}
    const draft=readDraft(sessionStorage);if(!draft||profile.rol!=='cliente')return;
    let active=true;const navigationAtStart=catalogNavigation.current;
    api.catalog(draft.category).then(async catalog=>{if(!active||navigationAtStart!==catalogNavigation.current)return;const shop=catalog.find(s=>String(s.id)===draft.shop),service=shop?.services.find(s=>String(s.id)===draft.service);if(!shop||!service?.bookable)throw Error('El servicio ya no está disponible para reservar. Consulta si requiere evaluación.');let promotion=null;if(draft.campaignId){const offers=await api.cutPromotions(),offer=offers.find(row=>String(row.campaign_id)===draft.campaignId&&String(row.service_id)===draft.service);if(!offer||Number(offer.regular_price)!==Number(draft.regularPrice)){clearDraft(sessionStorage);setView('promotions');setAccessMessage('El precio o la disponibilidad de la oferta cambió. Revisa las promociones actuales antes de continuar.');resumed.current=profile.id;return;}promotion={campaignId:draft.campaignId,regularPrice:Number(offer.regular_price),promoPrice:Number(offer.promo_price),serviceId:service.id,shopId:shop.id};}setSelectedShop(shop);setSelectedService(service);setSelectedPromotion(promotion);setSelectedBarber(draft.barber||'');setSelectedDate(draft.date);setSelectedTime(draft.barber&&!(shop.equipo??[]).some(m=>m.id===draft.barber&&m.servicios?.some(id=>String(id)===String(service.id)))?'':draft.time);setCustomRequest(draft.note);setCustomerInfo(prev=>({...prev,name:draft.name||profile.nombre||'',phone:draft.phone||profile.telefono||''}));resumed.current=profile.id;setView('client');cambiarCategoriaCatalogo(draft.category);setShowBookingModal(true);clearDraft(sessionStorage);setAccessMessage('Recuperamos tu reserva. Revisa el horario y completa solo los datos que faltan.');}).catch(error=>{if(active&&navigationAtStart===catalogNavigation.current)setAccessMessage(error.message);});
    return()=>{active=false;};
  },[identity.profile,cambiarCategoriaCatalogo]);
  const submitReservation = async () => {
    if(identity.loading){setAccessMessage('Restaurando tu sesión. Espera un momento antes de continuar.');return;}
    if(identity.error){setAccessMessage('No pudimos comprobar tu sesión. Reintenta la comprobación antes de iniciar sesión nuevamente.');return;}
    if(!reservationsEnabled){requireBookingLogin();return;}
    if (savingReservation || !selectedTime || !selectedService || !selectedBarber) return;
    setSavingReservation(true);
    setRequestSaved(false);
    try {
      await api.request({shop:selectedShop.id,service:selectedService.id,barber:selectedBarber,start:selectedTime,name:customerInfo.name,phone:customerInfo.phone,note:customRequest,campaignId:selectedPromotion?.campaignId||null,regularPrice:selectedPromotion?.regularPrice??null});
      // Notification is written in the same database transaction, never by the browser.
      setRequestSaved(true);
      window.dispatchEvent(new CustomEvent('meryo-booking-request-saved',{detail:{userId:identity.profile?.id}}));
      clearDraft(sessionStorage);setShowBookingModal(false);setSelectedPromotion(null);setPromotionError('');setView("my-bookings");
    } catch (error) {
      if(selectedPromotion){
        setPromotionError(error.message||'La oferta o el horario dejó de estar disponible. No se cambió el precio.');setSelectedTime('');setAgendaLoading(true);
        try{setActiveSlots(await api.cutPromotionSlots(selectedShop.id,selectedService.id,selectedDate,selectedBarber,selectedPromotion.campaignId));}catch{setActiveSlots([]);}
        finally{setAgendaLoading(false);}
      }else alert(error.message);
    }
    finally { setSavingReservation(false); }
  };

  const handleLogout = async () => {
    try {
      await disableBookingPush(api).catch(()=>{});
      await endSession(supabase, () => {setRequestSaved(false);setCustomerInfo({name:'',phone:''});setBarberLogin({email:'',password:''});clearDraft(sessionStorage);resumed.current='';setView('landing');});
      await identity.refresh();
    } catch (error) { alert("No se pudo cerrar sesión: " + error.message); }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    if(!emailSignupEnabled){setRegisterMessage('El registro por correo está pendiente del servicio de confirmación. Crea tu cuenta con Google.');return;}
    if (registerBusy) return;
    setRegisterBusy(true); setRegisterMessage("");
    try {
      const { data, error } = await supabase.auth.signUp({ email: registerForm.email, password: registerForm.password });
      if (error) throw error;
      if (!data.user) throw new Error("No se pudo completar la solicitud");
      setRegisterMessage("Solicitud recibida. Revisa tu correo si requiere confirmación. El acceso requiere un perfil de cliente activo provisionado por el servidor.");
      setRegisterForm({ email: "", password: "" });
    } catch (error) { setRegisterMessage(error.message); }
    finally { setRegisterBusy(false); }
  };

  const handleBarberLogin = async () => {
    if (!barberLogin.email || !barberLogin.password) return alert("Ingresa correo y contraseña");
    try {
      const profile=await signInWithProfile(supabase,barberLogin,['cliente','admin','barbero']);await identity.refresh();setBarberLogin(prev=>({...prev,password:''}));setView(accessView('barber',profile.rol));
    }catch(error){setAccessMessage(error.message);}
  };
  const handleCustomerLogin = async () => {
    if(!customerInfo.email||!customerInfo.password)return alert('Ingresa correo y contraseña');
    try{const profile=await signInWithProfile(supabase,{email:customerInfo.email,password:customerInfo.password},['cliente','barbero','admin']);await identity.refresh();setCustomerInfo(prev=>({...prev,password:''}));setView(bookingDestination(window.location.search,accessView(loginDestination,profile.rol)));}
    catch(error){alert(error.message);}
  };

  const basePrice =
  (selectedService?.price || selectedShop?.basePrice || 0);



const finalPrice = selectedPromotion ? Number((basePrice * 0.5).toFixed(2)) : basePrice;
  const navigateMobile=destination=>{
    if(destination==='explore'){setMobileExploreRequested(true);setView('client');return;}
    setMobileExploreRequested(false);setView(destination);
  };
  const backToOffers=()=>{closeBookingModal();setView('promotions');void loadCutOffers();};
  const renderBookingModal=()=> <BookingModal catalogCategory={catalogCategory} selectedShop={showBookingModal?selectedShop:null} selectedService={selectedService} selectedBarber={selectedBarber} setSelectedBarber={setSelectedBarber} setSelectedService={setSelectedService} selectedDate={selectedDate} setSelectedDate={setSelectedDate} selectedTime={selectedTime} setSelectedTime={setSelectedTime} customerInfo={customerInfo} setCustomerInfo={setCustomerInfo} customRequest={customRequest} setCustomRequest={setCustomRequest} activeSlots={activeSlots} finalPrice={finalPrice} requestSaved={requestSaved} submitReservation={submitReservation} closeBookingModal={closeBookingModal} savingReservation={savingReservation} reservationsEnabled={reservationsEnabled} agendaLoading={agendaLoading} agendaError={agendaError} accessMessage={accessMessage} onLogin={requireBookingLogin} identityLoading={identity.loading} identityError={identity.error} onRetrySession={()=>void identity.refresh()} promotion={selectedPromotion} promotionError={promotionError} onRegularPrice={continueAtRegularPrice} onBackToOffers={backToOffers}/>;
  if(view==='promotions')return <><CutPromotions offers={cutOffers} loading={cutOffersLoading} error={cutOffersError} notice={cutOffersNotice} onRetry={loadCutOffers} onBack={()=>setView('landing')} onOpenOffer={openCutOffer} onNavigate={navigateMobile} heroImage={BARBER_HERO_IMAGES[0]} bannerImage="/cut-promotions-banner.png" BottomNav={MobileBottomNav}/>{renderBookingModal()}</>;
  if(view === 'notifications')return <PushCenter api={api} profile={identity.profile} loading={identity.loading} onLogin={()=>openLogin('notifications')} onBack={()=>setView('client')}/>;
  if(view === 'team-invite')return <TeamInvite api={api} profile={identity.profile} onGoogle={handleGoogle} onEmail={()=>openLogin('team-invite')} onAccepted={async()=>{await identity.refresh();setView('barber');}} onBack={()=>setView('client')}/>;
  if(view==='account')return <main data-meryo-theme={catalogCategory==='belleza'?'beauty':'barberia'} className="min-h-screen bg-neutral-950 p-4 pb-24 text-white sm:p-6 sm:pb-24 md:pb-6"><div className="mx-auto max-w-3xl space-y-5"><h1 className="text-3xl font-black">Mi cuenta <span className="text-amber-400">MERYO</span></h1><button onClick={()=>setView('client')} className="rounded-xl border border-white/20 px-4 py-2">Volver</button>{identity.loading?<p role="status">Restaurando tu sesión…</p>:identity.error?<div role="alert" className="space-y-3"><p>No pudimos comprobar tu sesión.</p><button type="button" onClick={()=>void identity.refresh()} className="rounded-xl border border-white/20 px-4 py-3">Reintentar</button></div>:identity.profile?<section className="space-y-4 rounded-2xl border border-white/10 bg-neutral-900 p-6"><p>{identity.profile.nombre||'Tu cuenta'}</p>{identity.profile.rol==='barbero'&&<button onClick={()=>setView('shop-manage')} className="block w-full rounded-xl border border-white/20 px-4 py-3 text-left">Mi negocio</button>}{identity.profile.rol==='cliente'&&<button onClick={()=>setView('shop-register')} className="block w-full rounded-xl border border-white/20 px-4 py-3 text-left">Registrar un negocio</button>}{adminAccess&&<button onClick={()=>setView('admin')} className="block w-full rounded-xl border border-white/20 px-4 py-3 text-left">Administración</button>}<button onClick={()=>setView('notifications')} className="block w-full rounded-xl border border-white/20 px-4 py-3 text-left">Notificaciones</button><button onClick={()=>setView('my-orders')} className="block w-full rounded-xl border border-white/20 px-4 py-3 text-left">Mis pedidos de tienda</button><button onClick={()=>setView('account-security')} className="block w-full rounded-xl border border-white/10 px-4 py-3 text-left">Seguridad y recuperación</button><button onClick={handleLogout} className="block w-full rounded-xl border border-white/10 px-4 py-3 text-left">Cerrar sesión</button></section>:<button onClick={()=>openLogin('account')} className="rounded-xl bg-amber-400 px-4 py-3 font-bold text-black">Iniciar sesión</button>}</div><MobileBottomNav active="account" onNavigate={navigateMobile}/></main>;
  if(view === 'account-security')return identity.profile?<AdminMfa client={supabase} onVerified={async()=>{await identity.refresh();setAccessMessage('Authenticator verificado por Supabase. Tu rol no cambia. Registra un segundo factor en otro dispositivo para recuperación.');setView('client');}} onBack={()=>setView('client')}/>:<div className="min-h-screen bg-neutral-950 p-8 text-white"><button onClick={()=>setView('client-login')}>Iniciar sesión para proteger mi cuenta</button></div>;
  const registration=<ShopRegistration profile={identity.profile} loading={identity.loading} form={affiliateForm} setForm={setAffiliateForm} busy={affiliateBusy} error={affiliateError||accessMessage||identity.error} onSubmit={handleAffiliateSubmit} onGoogle={()=>handleGoogle('shop-register')} onLogin={()=>openLogin('shop-register')} onManage={()=>setView('shop-manage')}/>;
  if(view==='shop-register')return <main className="min-h-screen bg-neutral-950 p-6 text-white"><div className="mx-auto max-w-2xl space-y-5 rounded-3xl border border-white/10 bg-neutral-900 p-6"><h1 className="text-3xl font-black">Registro de negocios <span className="text-amber-400">MERYO</span></h1><button onClick={()=>setView('client')} className="rounded-xl border border-white/20 px-4 py-2">Volver al catálogo</button>{registration}</div></main>;
  if(view === 'shop-manage') return <ShopManagement key={identity.profile?.id||'anonymous'} api={api} profile={identity.profile} onLogin={()=>openLogin(pickupOrderIdFromSearch(window.location.search)?'shop-order':'barber')} onBack={async()=>{await cargarBarberiasActivas();setView('client');}} onRegister={()=>setView('shop-register')}/>;
  if(view==='my-orders') return <div data-meryo-theme={catalogCategory==='belleza'?'beauty':'barberia'}><Suspense fallback={<p className="min-h-screen bg-neutral-950 p-8 text-white">Cargando pedidos…</p>}><MyPickupOrders api={api} profile={identity.profile} identityLoading={identity.loading} onLogin={destination=>openLogin(destination)} onBack={()=>{const url=new URL(window.location.href);url.searchParams.delete('pedido');window.history.replaceState(null,'',url.pathname+url.search+url.hash);setView('client');}}/></Suspense></div>;
  if(view === 'my-bookings') return <div data-meryo-theme={catalogCategory==='belleza'?'beauty':'barberia'} className="min-h-screen bg-neutral-950 p-4 pb-24 text-white sm:p-6 sm:pb-24 md:pb-6"><div className="mx-auto max-w-5xl space-y-5"><header className="meryo-bookings-page-header"><MeryoLogo variant={catalogCategory==='belleza'?'light':'dark'} className="h-7 w-auto shrink-0"/><button onClick={()=>{const url=new URL(window.location.href);url.searchParams.delete('cita');window.history.replaceState(null,'',url.pathname+url.search+url.hash);setView('client');}} className="hidden rounded-xl border border-white/20 px-4 py-2 sm:inline-flex">Volver al catálogo</button></header>{requestSaved&&identity.profile?.rol==='cliente'&&<section aria-labelledby="meryo-request-saved-title" className="rounded-xl bg-white/5 p-4"><h2 id="meryo-request-saved-title" className="font-bold">Solicitud enviada</h2><p role="status" className="mt-1 text-sm">El negocio tiene hasta 15 minutos para responder. Puedes consultar el estado aquí, en Mis citas.</p></section>}<Reservations key={`${identity.profile?.id}-${identity.profile?.rol}`} api={api} profile={identity.profile} identityLoading={identity.loading} identityError={identity.error} onRetrySession={()=>void identity.refresh()} onLogin={()=>openLogin('my-bookings')} onSearch={()=>{const url=new URL(window.location.href);url.searchParams.delete('cita');window.history.replaceState(null,'',url.pathname+url.search+url.hash);setQuery('');setDistrict('');setShowBookingModal(false);setView('client');}}/></div><MobileBottomNav active="my-bookings" onNavigate={navigateMobile}/></div>;
  if (view === "landing") {
    return <LandingPage setView={setView} onExplore={openCatalogCategory} onPromotions={()=>setView('promotions')} profile={identity.profile} identityLoading={identity.loading} adminAccess={adminAccess} onSignIn={()=>openLogin('client')} onAccount={()=>setView('account')} onProfessionalAccess={()=>{if(adminAccess)setView('admin');else if(identity.profile?.rol==='barbero')setView('shop-manage');else if(identity.profile?.rol==='cliente')setView('shop-register');else setView('barber-login');}}/>;
  }

  if (view === "barber" || view === "barber-login") {
    if (!barberLoggedIn) {
      return (
        <div className="min-h-screen bg-neutral-950 p-8 text-white">
          <div className="mx-auto mt-12 max-w-md rounded-[2rem] border border-white/10 bg-neutral-900 p-8 shadow-2xl">
            <p className="text-sm uppercase tracking-[0.2em] text-amber-400">Acceso profesional</p>
            <h1 className="mt-2 text-3xl font-black">Login MERYO</h1>
            <p className="mt-3 text-sm text-neutral-400">Inicia sesión para registrar tu negocio o entrar a su gestión. Los permisos se verifican con tu cuenta real.</p>
            <button onClick={handleGoogle} className="mt-4 w-full rounded-xl border border-white/20 p-3">Continuar con Google</button>
            {(accessMessage||identity.error)&&<p role="alert" className="mt-3 text-amber-300">{accessMessage||identity.error}</p>}
            <a href="/#shop-register" className="mt-3 block text-amber-300 underline">Registrar un negocio</a>
            <button onClick={()=>setView('admin')} className="mt-3 text-sm text-amber-300">Acceso administrador</button>
            {supabase.authUnavailable&&<p role="status" className="mt-3 text-amber-300">Falta Supabase Auth de pruebas. No hay acceso local por rol ni administrador ficticio.</p>}
            <div className="mt-6 space-y-3">
            <input
  value={barberLogin.email}
  onChange={(e) =>
    setBarberLogin((prev) => ({
      ...prev,
      email: e.target.value,
    }))
  }
  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
  placeholder="Correo del barbero"
/>
              <input type="password" value={barberLogin.password} onChange={(e) => setBarberLogin((prev) => ({ ...prev, password: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none" placeholder="Contraseña" />
              <button onClick={handleBarberLogin} className={`w-full rounded-xl bg-amber-400 px-4 py-3 font-bold text-black ${pointerClass}`}>Ingresar al panel</button>
              <button onClick={() => setView("landing")} className={`w-full rounded-xl border border-white/10 px-4 py-3 font-bold ${pointerClass}`}>Volver al inicio</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-neutral-950 p-8 text-white">
        <h1 className="mb-2 text-3xl font-black">Panel Profesional <span className="text-amber-400">MERYO</span></h1>
        <p className="mb-6 text-neutral-400">Aceptación manual en 15 minutos. El estado y los vencimientos los determina el servidor.</p>
        <button onClick={()=>setView('shop-manage')} className="mb-6 rounded-xl bg-amber-400 px-4 py-2 font-bold text-black">Perfil, servicios y horarios</button>
        <Reservations key={`${identity.profile?.id}-${identity.profile?.rol}`} api={api} profile={identity.profile} onLogin={()=>setView('barber-login')} onSearch={()=>setView('client')}/>
        <div className="mt-10 flex flex-wrap gap-3">
          <button onClick={() => setView("client")} className={`rounded-xl bg-amber-400 px-4 py-2 font-bold text-black ${pointerClass}`}>Volver</button>
          <button onClick={handleLogout} className={`rounded-xl border border-white/10 px-4 py-2 font-bold ${pointerClass}`}>Cerrar sesión</button>
        </div>
      </div>
    );
  }
  if(view === "admin"&&adminAccess&&(!adminAal2||adminSecurityOpen))return <AdminMfa client={supabase} onVerified={async()=>{await identity.refresh();setAdminAal2(true);setAdminSecurityOpen(false);}} onBack={()=>{setAdminSecurityOpen(false);if(!adminAal2)setView("client");}}/>;
  if (view === "admin" && !adminAccess) {
    return <div className="min-h-screen bg-neutral-950 p-8 text-white"><div className="mx-auto mt-12 max-w-md rounded-[2rem] border border-white/10 bg-neutral-900 p-8 shadow-2xl"><h1 className="text-3xl font-black">Administración MERYO</h1><p className="mt-3 text-sm text-neutral-400">Iniciar sesión como administrador requiere tu cuenta autorizada y Authenticator. Google no asigna permisos administrativos.</p>{identity.loading?<p role="status" className="mt-4">Comprobando sesión…</p>:identity.profile?<p role="alert" className="mt-4 text-amber-300">Esta cuenta no tiene permisos administrativos.</p>:<><button onClick={handleGoogle} className="mt-6 w-full rounded-xl border border-white/20 p-3">Continuar con Google</button><button onClick={()=>openLogin('admin')} className="mt-3 w-full rounded-xl border border-white/10 px-4 py-3">Usar correo y contraseña</button></>}{accessMessage&&<p role="status" className="mt-3 text-amber-300">{accessMessage}</p>}<button onClick={()=>setView('client')} className="mt-4 text-sm text-neutral-400">Volver al catálogo</button></div></div>;
  }
if(['client-auth','client-register','client-login'].includes(view)&&identity.loading)return <main className="flex min-h-screen items-center justify-center bg-neutral-950 p-6 text-neutral-200"><p role="status">Restaurando tu sesión…</p></main>;
if(['client-auth','client-register','client-login'].includes(view)&&identity.error)return <main className="flex min-h-screen items-center justify-center bg-neutral-950 p-6 text-white"><section className="max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-6"><p role="alert">No pudimos comprobar tu sesión todavía.</p><button type="button" onClick={()=>void identity.refresh()} className="mt-4 rounded-xl border border-white/20 px-4 py-3">Reintentar</button></section></main>;
if(['client-auth','client-register','client-login'].includes(view)&&identity.profile)return <main className="flex min-h-screen items-center justify-center bg-neutral-950 p-6 text-white"><section className="max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-6"><p>Ya tienes una sesión activa en este navegador.</p><button type="button" onClick={()=>setView('client')} className="mt-4 rounded-xl bg-amber-400 px-4 py-3 font-bold text-black">Continuar a MERYO</button></section></main>;
if (view === "client-auth") {
  return (
    <div
      className="min-h-screen bg-cover bg-center text-white"
      style={{
        backgroundImage:
          "url(https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1800&q=80)",
      }}
    >
      <div className="min-h-screen bg-black/70 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-neutral-950/90 p-8 shadow-2xl">
          <p className="text-sm uppercase tracking-[0.2em] text-amber-400">
            Bienvenido a MERYO
          </p>

          <h1 className="mt-3 text-4xl font-black leading-tight">
            {catalogCategory==='belleza'?'Reserva, califica y habla con tu profesional de belleza.':'Reserva, califica y habla con tu barbero.'}
          </h1>

          <p className="mt-4 text-sm text-neutral-300">
            Crea tu cuenta una sola vez para ingresar a MERYO y acceder a una experiencia completa.
          </p>

          <div className="mt-8 space-y-3">
            <button
              onClick={() => setView("client-register")}
              className="w-full rounded-2xl bg-amber-400 px-4 py-3 font-bold text-black"
            >
              Crear cuenta
            </button>

            <button
              onClick={() => openLogin('client')}
              className="w-full rounded-2xl border border-white/10 px-4 py-3 font-bold text-white"
            >
              Iniciar sesión
            </button>

            <button
              onClick={() => setView("landing")}
              className="w-full rounded-2xl border border-white/10 px-4 py-3 text-sm text-neutral-300"
            >
              Volver
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
if (view === "client-register") {
  return <div className="min-h-screen flex items-center justify-center bg-black text-white p-6">
    <form onSubmit={handleRegister} className="w-full max-w-md bg-neutral-900 p-8 rounded-2xl border border-white/10">
      <h2 className="text-2xl font-bold mb-6">Crear cuenta</h2><button type="button" onClick={handleGoogle} className="mb-4 w-full rounded-xl border border-white/20 p-3">Continuar con Google</button>{accessMessage&&<p role="status" className="mb-4 text-amber-300">{accessMessage}</p>}
      {supabase.authUnavailable&&<p role="status" className="mb-4 text-amber-300">Registro bloqueado hasta conectar Supabase Auth de pruebas. Tus credenciales no se enviarán a producción.</p>}
      {!emailSignupEnabled&&<p role="status" className="mb-4 text-sm text-amber-300">Crea tu cuenta con Google. El registro por correo está pendiente del servicio de confirmación; el acceso por correo de cuentas existentes se conserva.</p>}
      <input aria-label="Correo" type="email" required disabled={!emailSignupEnabled} autoComplete="email" value={registerForm.email} onChange={e => setRegisterForm(prev => ({...prev, email:e.target.value}))} placeholder="Correo" className="w-full mb-3 px-4 py-3 rounded-xl bg-black border border-white/10 disabled:opacity-50" />
      <input aria-label="Contraseña" type="password" required disabled={!emailSignupEnabled} minLength={8} autoComplete="new-password" value={registerForm.password} onChange={e => setRegisterForm(prev => ({...prev, password:e.target.value}))} placeholder="Contraseña (mínimo 8 caracteres)" className="w-full mb-6 px-4 py-3 rounded-xl bg-black border border-white/10 disabled:opacity-50" />
      <button disabled={registerBusy||!emailSignupEnabled} className="w-full bg-amber-400 text-black py-3 rounded-xl font-bold disabled:opacity-50">{registerBusy ? "Enviando…" : "Crear cuenta"}</button>
      {registerMessage && <p role="status" className="mt-4 text-sm">{registerMessage}</p>}
      <button type="button" onClick={() => setView("client-auth")} className="w-full mt-3 text-sm text-neutral-400">Volver</button>
    </form></div>;
}
if (view === "client-login") {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white p-6">
      <div className="w-full max-w-md bg-neutral-900 p-8 rounded-2xl border border-white/10">
        
        <h2 className="text-2xl font-bold mb-6">Iniciar sesión</h2><button onClick={handleGoogle} className="mb-4 w-full rounded-xl border border-white/20 p-3">Continuar con Google</button>{accessMessage&&<p role="status" className="mb-4 text-amber-300">{accessMessage}</p>}
        {supabase.authUnavailable&&<p role="status" className="mb-4 text-amber-300">Falta conectar Supabase Auth de pruebas. No se admite un acceso simulado.</p>}

        <input
          type="email"
          placeholder="Correo"
          className="w-full mb-3 px-4 py-3 rounded-xl bg-black border border-white/10"
          onChange={(e) => setCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
        />

        <input
          type="password"
          placeholder="Contraseña"
          className="w-full mb-6 px-4 py-3 rounded-xl bg-black border border-white/10"
          onChange={(e) => setCustomerInfo(prev => ({ ...prev, password: e.target.value }))}
        />

        <button
          onClick={handleCustomerLogin}
          className="w-full bg-amber-400 text-black py-3 rounded-xl font-bold"
        >
          Entrar
        </button>

        <button
          onClick={() => setView("client-auth")}
          className="w-full mt-3 text-sm text-neutral-400"
        >
          Volver
        </button>

      </div>
    </div>
  );
}
if (view === "admin" && adminAccess) return <AdminShops api={api} profile={identity.profile} onSecurity={()=>setAdminSecurityOpen(true)} onLogout={handleLogout} onBack={()=>setView('client')} onChanged={cargarBarberiasActivas}/>;
  return (
    <div data-meryo-theme={catalogCategory==='belleza'?'beauty':'barberia'} className="min-h-screen bg-neutral-950 pb-24 text-white md:pb-0">
      <header className="meryo-site-header sticky top-0 z-30 border-b border-white/10 bg-neutral-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col items-stretch gap-2 px-3 py-2 md:flex-row md:items-center md:justify-between md:px-6 md:py-4">
          <MeryoLogo variant={catalogCategory==='belleza'?'light':'dark'} className="h-7 w-auto shrink-0 md:h-9" />
          <div className="hidden w-full min-w-0 grid-cols-3 gap-1.5 md:flex md:w-auto md:flex-wrap md:gap-3">
            <button onClick={() => setView("landing")} className={`min-h-11 w-full rounded-xl border border-white/20 px-2 py-2 text-xs leading-tight md:min-h-0 md:w-auto md:px-4 md:py-2 md:text-sm ${pointerClass}`}>Inicio</button>
            <button disabled={identity.loading} onClick={() => setView(adminAccess?'admin':"barber")} className={`min-h-11 w-full rounded-xl border border-white/20 px-2 py-2 text-xs leading-tight disabled:opacity-50 md:min-h-0 md:w-auto md:px-4 md:py-2 md:text-sm ${pointerClass}`}>{identity.loading?'Restaurando sesión…':adminAccess?'Panel Administrador':'Panel Profesional'}</button>
            <button onClick={()=>setView('my-bookings')} className="min-h-11 w-full rounded-xl border border-white/20 px-2 py-2 text-xs leading-tight md:min-h-0 md:w-auto md:px-4 md:py-2 md:text-sm">Mis citas</button>
            <button disabled={identity.loading} onClick={()=>setView('shop-manage')} className="min-h-11 w-full rounded-xl border border-white/20 px-2 py-2 text-xs leading-tight disabled:opacity-50 md:min-h-0 md:w-auto md:px-4 md:py-2 md:text-sm">Mi negocio</button>
            <button disabled={identity.loading} onClick={()=>setView(identity.profile?'account':'client-auth')} className="min-h-11 w-full rounded-xl border border-white/20 px-2 py-2 text-xs leading-tight disabled:opacity-50 md:min-h-0 md:w-auto md:px-4 md:py-2 md:text-sm">{identity.loading?'Restaurando sesión…':'Mi cuenta'}</button>
            {adminAccess&&<button onClick={()=>setView('admin')} className="min-h-11 w-full rounded-xl border border-white/20 px-2 py-2 text-xs leading-tight md:min-h-0 md:w-auto md:px-4 md:py-2 md:text-sm">Administración</button>}

            <button onClick={handleLogout} className="min-h-11 w-full rounded-xl border border-white/20 px-2 py-2 text-xs leading-tight md:min-h-0 md:w-auto md:px-4 md:py-2 md:text-sm">Cerrar sesión</button>
            <button onClick={enableLocation} className={`hidden rounded-xl bg-amber-400 px-4 py-2 font-semibold text-black md:block ${pointerClass}`}>Usar ubicación</button>
          </div>
        </div>
      </header>

      <main>
        {supabase.authUnavailable&&<p role="status" className="mx-auto max-w-7xl px-6 pt-5 text-amber-300">Puedes consultar perfiles, servicios y calendario. Registro, acceso y operaciones privadas requieren Supabase Auth de pruebas; no hay sesiones ficticias.</p>}
        {identity.error&&<p role="alert" className="px-6 text-red-300">{identity.error}</p>}
        {accessMessage&&<p role="status" className="px-6 text-amber-300">{accessMessage}</p>}
        {profileUnavailable&&<div role="alert" className="mx-auto my-5 max-w-4xl rounded-2xl border border-white/15 bg-neutral-900 p-5"><h1 className="text-xl font-bold">Este negocio ya no está disponible</h1><p className="mt-2 text-neutral-300">No mostramos perfiles que ya no están publicados.</p><button onClick={closeProfileModal} className="mt-4 rounded-xl border border-amber-400/50 px-4 py-2 text-amber-200">Volver al catálogo</button></div>}
        <section id="catalogo" className="meryo-catalog-section mx-auto max-w-7xl px-3 pt-4 pb-10 md:px-6 md:py-16">
          <ClientHero heroIndex={heroIndex} setHeroIndex={setHeroIndex} setView={setView} catalogCategory={catalogCategory} />

          <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-black">{catalogCategory==='belleza'?'Peluquerías y salones cerca de ti':'Barberías cerca de ti'}</h2>
              <CatalogFilters query={query} district={district} order={order} hasLocation={!!location} onQuery={setQuery} onDistrict={setDistrict} onOrder={setOrder} onUseLocation={enableLocation} businessLabel={catalogCategory==='belleza'?'salón':'barbería'} businessPlural={catalogCategory==='belleza'?'peluquerías y salones':'barberías'} />
              <p className="mt-2 text-neutral-400">Solicita una cita. La confirmación requiere aceptación y verificación del adelanto por el servidor.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-neutral-300">
              {catalogLoading||!catalogMatchesCategory?'Cargando…':catalogError?'Catálogo no disponible':catalogCountLabel(catalogCategory,ranking.length)}
            </div>
          </div>

          {locationError && <p role="alert" className="mb-4 text-sm text-amber-300">{locationError}</p>}
          <button onClick={() => setShowMap(value => !value)} aria-expanded={showMap} className="mb-4 rounded-xl border border-white/10 px-4 py-2 text-sm">{showMap ? "Ocultar mapa" : "Ver mapa"}</button>
          {showMap && <div className="mb-10 rounded-3xl border border-white/10 bg-neutral-900 p-6">
            <Suspense fallback={<p role="status">Cargando mapa…</p>}>
              <CatalogMap markers={markers} location={location} onSelect={id => { const shop = catalogRows.find(item => item.id === id); if (shop) openProfileModal(shop); }} />
            </Suspense>
            {markers.length === 0 && <p className="mt-3 text-sm text-neutral-400">No hay ubicaciones verificables para estos resultados.</p>}
          </div>}
          {catalogRows.length > 0 && ranking.length === 0 && <p role="status" className="mb-6 text-neutral-400">No encontramos {catalogCategory==='belleza'?'peluquerías ni salones':'barberías'} con esos filtros.</p>}
          <CatalogStatus loading={catalogLoading||!catalogMatchesCategory} error={catalogMatchesCategory?catalogError:''} empty={catalogRows.length===0} businessLabel={catalogCategory==='belleza'?'peluquerías y salones':'barberías'} onRetry={cargarBarberiasActivas}/>

          <CatalogShopGrid shops={ranking} category={catalogCategory} onView={openProfileModal} onReserve={openBookingModal}/>
        </section>

        <section className="border-y border-white/10 bg-neutral-900 py-16">
          <div className="mx-auto grid max-w-7xl gap-8 px-6 md:grid-cols-2">
            <div className="meryo-info-block meryo-info-block--teal rounded-3xl border border-white/10 bg-neutral-950 p-6">
              <h2 className="text-2xl font-black">Solicita tu cita</h2><p className="mt-3 text-neutral-400">Elige un servicio en el catálogo. El adelanto del 50 % se solicita únicamente después de que {catalogCategory==='belleza'?'el profesional del salón':'el barbero'} acepte.</p>
            </div>
            <div className="meryo-info-block meryo-info-block--sky rounded-3xl border border-white/10 bg-neutral-950 p-6">
              <div className="mb-6 flex items-center justify-between gap-3">
                <div>
                  <h2 id="register-shop" className="text-2xl font-black">Registro de negocios</h2>
                  <p className="mt-2 text-neutral-400">Afíliate y recibe clientes sin depender solo de Instagram o WhatsApp.</p>
                </div>
                <button onClick={() => setShowAffiliateForm((prev) => !prev)} className={`rounded-xl bg-amber-400 px-4 py-2 font-bold text-black ${pointerClass}`}>{showAffiliateForm ? "Ocultar" : "Registrar"}</button>
              </div>
           {showAffiliateForm ? (
  registration
) : (
  <div className="rounded-2xl border border-dashed border-white/10 bg-neutral-900 p-6 text-sm text-neutral-400">
    Activa el registro para mostrar el formulario de afiliación de negocios.
  </div>
)}
              
            </div>
          </div>
        </section>
      </main>

      <ProfileModal
        selectedShop={showProfileModal ? selectedShop : null}
        catalogCategory={catalogCategory}
        onClose={closeProfileModal}
        onStore={openStoreModal}
        onReserve={() => {
          setShowProfileModal(false);
          openBookingModal(selectedShop);
        }}
      />

      {showStoreModal&&storeShop&&<Suspense fallback={null}><StoreModal key={`${storeShop.id}-${Boolean(restoredPickupCart)}`} api={api} shop={storeShop} profile={identity.profile} category={storeCategory} initialCart={restoredPickupCart} onLogin={destination=>openLogin(destination)} onClose={()=>{setShowStoreModal(false);setRestoredPickupCart(null);}} onOpenOrders={orderId=>{setShowStoreModal(false);const url=new URL(window.location.href);url.searchParams.set('pedido',orderId);window.history.replaceState(null,'',url.pathname+url.search+'#my-orders');setView('my-orders');}}/></Suspense>}

      {renderBookingModal()}

      <MobileBottomNav active="explore" onNavigate={navigateMobile}/>

      <footer className="border-t border-white/10 py-6 text-center text-neutral-500">© 2026 MERYO <a href="/privacidad.html" className="ml-4 hover:text-amber-400">Privacidad</a><a href="/condiciones.html" className="ml-4 hover:text-amber-400">Condiciones</a></footer>
    </div>
  );
}
