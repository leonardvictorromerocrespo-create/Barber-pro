import { endSession, signInWithProfile } from "./lib/operations";
import { supabase, googleAuthEnabled, emailSignupEnabled } from "./lib/supabase";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createMeryoApi, readResult } from './lib/meryo-api';
import { useIdentity } from './lib/useIdentity';
import Reservations from './components/Reservations';
import AdminMfa from './components/AdminMfa';
import AdminShops from './components/AdminShops';
import {disableBookingPush} from './lib/push';
import {saveDraft,readDraft,clearDraft,beginGoogle} from './lib/booking-draft';
import {rememberAccess,consumeAccess,accessView} from './lib/access-navigation';
import ShopManagement from './components/management/ShopManagement';
const api = createMeryoApi(supabase);
import CatalogFilters from "./components/CatalogFilters";
import CatalogStatus from './components/CatalogStatus';
import { selectShops, catalogMarkers, coordinates } from "./lib/catalog";
import { listaDias } from "./lib/dates";
const CatalogMap = lazy(() => import("./components/CatalogMap"));

const pointerClass = "cursor-pointer";

const AVAILABLE_DATES = listaDias(3);
const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1600&q=80",
];

function ClientHero({ heroIndex, setHeroIndex, setView }) {
  return (
    <>
      <div className="mb-10 overflow-hidden rounded-3xl border border-white/10 bg-black">
        <div className="relative h-72 w-full">
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-1000"
            style={{ backgroundImage: `url(${HERO_IMAGES[heroIndex]})` }}
          />
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute bottom-4 right-4 z-20 flex gap-2">
            {HERO_IMAGES.map((_, index) => (
              <button
                key={index}
                onClick={() => setHeroIndex(index)}
                className={`h-2.5 w-8 rounded-full transition ${pointerClass} ${
                  heroIndex === index ? "bg-amber-400" : "bg-white/40"
                }`}
              />
            ))}
          </div>
          <div className="relative z-10 flex h-full flex-col justify-center px-8">
            <h1 className="text-3xl font-extrabold tracking-wide text-white md:text-5xl">
              EL ESTILO NO SE IMPROVISA
            </h1>
            <p className="mt-3 max-w-xl text-sm text-neutral-300 md:text-base">
              Descubre barberos reales cerca de ti. Mira sus trabajos, conoce su estilo y reserva tu cita en segundos.
            </p>
            <div className="mt-4 text-xs uppercase tracking-widest text-amber-400">
              MERYO • Reserva inteligente
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setView("barber")}
                className={`rounded-xl border border-white/20 bg-black/30 px-4 py-2 text-sm font-bold ${pointerClass}`}
              >
                Soy barbero
              </button>
            </div>
          </div>
        </div>
      </div>

    </>
  );
}

export function ProfileModal({ selectedShop, onClose, onReserve }) {
  if (!selectedShop) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-[2rem] border border-white/10 bg-neutral-950 p-6 text-white shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-amber-300">Perfil de barbería</p>
            <h3 className="mt-2 text-3xl font-black">{selectedShop.name}</h3>
            <p className="mt-2 text-neutral-400">
              Aquí el cliente solo ve la información del barbero: presentación, experiencia, videos, reseñas y servicios.
            </p>
          </div>
          <button onClick={onClose} className={`rounded-xl border border-white/10 px-4 py-2 text-sm ${pointerClass}`}>
            Cerrar
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="text-xl font-bold">Perfil del barbero</h4>
            <div className="mt-2 text-xs text-neutral-500">Perfil tipo red social del barbero</div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-neutral-300">
              <p className="leading-6 text-neutral-400">{selectedShop.about}</p>
              <p className="mt-3">{selectedShop.direccion} · {selectedShop.district}</p>
              {selectedShop.image&&<img src={selectedShop.image} alt={`Portada de ${selectedShop.name}`} className="mt-4 max-h-72 w-full rounded-xl object-cover"/>}
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="font-bold text-white">{selectedShop.introVideoTitle}</p>
              {selectedShop.assets?.some(a=>a.kind==='video'&&a.url)?selectedShop.assets.filter(a=>a.kind==='video'&&a.url).map(a=><video key={a.id} src={a.url} controls preload="metadata" className="mt-3 max-h-80 w-full rounded-2xl"/>):<p className="mt-3 text-sm text-neutral-400">Sin video publicado.</p>}
              {selectedShop.contentError&&<p role="alert" className="mt-3 text-sm text-amber-300">{selectedShop.contentError}</p>}
            </div>
          </div>

          <div>
            <h4 className="text-xl font-bold">Videos y portafolio de cortes</h4>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="font-bold text-white">{selectedShop.cutsVideoTitle}</p>
              <div className="mt-3 grid grid-cols-2 gap-3">{selectedShop.assets?.filter(a=>a.kind==='foto'&&a.url).map(a=><figure key={a.id}><img src={a.url} alt={a.title||'Trabajo publicado por la barbería'} className="h-40 w-full rounded-xl object-cover"/>{a.title&&<figcaption className="mt-1 text-xs text-neutral-400">{a.title}</figcaption>}</figure>)}</div>
              {!selectedShop.assets?.some(a=>a.kind==='foto'&&a.url)&&<p className="mt-3 text-sm text-neutral-400">Sin fotos de portafolio publicadas.</p>}
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4"><h4 className="font-bold">Equipo publicado</h4>{selectedShop.equipo?.length?selectedShop.equipo.map((p,i)=><p key={i} className="mt-2 text-sm text-neutral-300">{p.nombre}{p.propietario?' · propietario':''}</p>):<p className="mt-2 text-sm text-neutral-400">El equipo todavía no está publicado.</p>}</div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="font-bold text-white">Servicios disponibles</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {selectedShop.services.map((service) => (
                  <div key={service.id} className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm">
                    <p className="font-semibold text-white">{service.name}</p>
                    <p className="mt-1 text-neutral-400">{service.duration}</p>
                    <p className="mt-2 text-amber-400">S/ {service.price}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-6">
              <p className="text-lg font-bold text-white">Reseñas de clientes</p>
              <p className="mt-2 text-neutral-400">{selectedShop.reviews>0?`⭐ ${selectedShop.rating} basado en ${selectedShop.reviews} reseñas registradas`:'Aún no hay reseñas registradas.'}</p>
              <p className="mt-4 text-sm text-neutral-400">Las reseñas verificadas se incorporarán desde las citas completadas. No se muestran opiniones de demostración.</p>
              {selectedShop.resenas?.map(r=><article key={r.id} className="mt-4 border-t border-white/10 pt-3"><p className="text-sm">{r.autor} · {r.calificacion}/5</p><p className="mt-1 text-neutral-400">{r.comentario}</p></article>)}
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button onClick={onReserve} className={`rounded-2xl bg-amber-400 px-6 py-3 font-bold text-black ${pointerClass}`}>
            Reservar cita
          </button>
        </div>
      </div>
    </div>
  );
}

export function BookingModal({
  selectedShop,
  selectedService,
  setSelectedService,
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
}) {
  if (!selectedShop) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      
      <div className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-[2rem] border border-white/10 bg-neutral-950 p-6 text-white shadow-2xl">
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
              <h4 className="text-xl font-bold">1. Elige tu servicio y barbero</h4><label className="mt-3 block text-sm">Barbero / agenda de la barbería<select aria-label="Barbero" className="mt-2 block w-full rounded-xl border border-white/10 bg-neutral-900 p-3" value={selectedShop.id} onChange={()=>{}}><option value={selectedShop.id}>{selectedShop.name} · agenda única</option></select></label>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {selectedShop.services.map((service) => (
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
                    <p className="mt-3 text-lg font-black">S/ {service.price}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-neutral-900 p-5">
              <h4 className="text-xl font-bold">2. Elige la fecha</h4>
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
              {agendaLoading&&<p>Cargando horarios del servidor…</p>}{agendaError&&<p role="alert" className="text-red-300">{agendaError}</p>}{!agendaLoading&&!agendaError&&!activeSlots.length&&<p>Sin horarios disponibles para este servicio y fecha.</p>}
              <div className="mt-4 grid gap-3 sm:grid-cols-3 md:grid-cols-4">
                {activeSlots.map((slot) => (
                  <button
                    key={`${selectedDate}-${slot.time}`}
                    disabled={slot.occupied}
                    onClick={() => setSelectedTime(slot.time)}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
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
              <div className="flex justify-between"><span>Fecha</span><span>{selectedDate}</span></div>
              <div className="flex justify-between"><span>Hora</span><span>{activeSlots.find(slot=>slot.time===selectedTime)?.label || "Selecciona una hora"}</span></div>
              <div className="flex justify-between"><span>Pedido especial</span><span className="max-w-[170px] text-right">{customRequest || "No"}</span></div>
              <div className="flex justify-between"><span>Adelanto tras aceptar</span><span>S/ {(finalPrice * 0.5).toFixed(2)}</span></div>
              <div className="flex justify-between text-lg font-black"><span>Total</span><span className="text-amber-300">S/ {finalPrice}</span></div>
            </div>
            <p className="mt-5 text-sm text-amber-200">El barbero tendrá hasta 15 minutos para aceptar tu solicitud. Te avisaremos cuando puedas pagar el adelanto del 50 %.</p>
            <button
              onClick={submitReservation}
              disabled={savingReservation || !selectedTime || (reservationsEnabled&&(!customerInfo.name.trim() || !customerInfo.phone.trim())) || requestSaved}
              className={`mt-6 w-full rounded-xl py-3 font-bold ${
                selectedTime && customerInfo.name.trim() && customerInfo.phone.trim() && !requestSaved
                  ? `${pointerClass} bg-amber-400 text-black`
                  : "cursor-not-allowed bg-neutral-700 text-neutral-400"
              }`}
            >
              {requestSaved ? "Solicitud guardada" : savingReservation ? "Guardando…" : "Solicitar cita"}
            </button>
            {!reservationsEnabled&&<div className="mt-3 text-sm text-amber-300"><p>Al solicitar, continúa con Google o con correo y contraseña. Conservaremos tu selección; no se realiza ningún cobro.</p><button onClick={onLogin} className="mt-2 underline">Iniciar sesión</button></div>}
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
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [query, setQuery] = useState("");
  const [district, setDistrict] = useState("");
  const [order, setOrder] = useState("name");
  const [loginDestination,setLoginDestination]=useState('client');
  const allowedViews=['landing','client','client-auth','client-register','client-login','barber','barber-login','admin','account-security','shop-manage','my-bookings'];
  const [view, setView] = useState(()=>{const hash=typeof window==='undefined'?'':window.location.hash.slice(1);return allowedViews.includes(hash)?hash:'landing';});
  useEffect(()=>{window.history.replaceState(null,'',`#${view}`);},[view]);
  const identity = useIdentity(supabase);
  const adminAccess = identity.profile?.rol === 'admin' && identity.profile?.activo === true;
  const [adminAal2,setAdminAal2]=useState(false);
  const [adminSecurityOpen,setAdminSecurityOpen]=useState(false);
  const [accessMessage,setAccessMessage]=useState('');
  const resumed=useRef('');
  useEffect(()=>{let active=true;setAdminAal2(false);if(adminAccess)supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({data,error})=>{if(active)setAdminAal2(!error&&data?.currentLevel==='aal2');});return()=>{active=false;};},[identity.profile,adminAccess]);
  const barberLoggedIn = identity.profile?.rol === 'barbero';
  const [catalogError,setCatalogError] = useState('');
  const [catalogLoading,setCatalogLoading]=useState(true);
  const [activeSlots,setActiveSlots] = useState([]);
  const [agendaError,setAgendaError] = useState('');
  const [agendaLoading,setAgendaLoading] = useState(false);
  const [shops, setShops] = useState([]);
  // Public RPC contract; authenticated requests stay blocked without real Auth.
  const reservationsEnabled = identity.profile?.rol === 'cliente' && !supabase.authUnavailable;
  const [savingReservation, setSavingReservation] = useState(false);
  const [registerForm, setRegisterForm] = useState({ email: "", password: "" });
  const [registerBusy, setRegisterBusy] = useState(false);
  const [registerMessage, setRegisterMessage] = useState("");
  const [affiliateForm, setAffiliateForm] = useState({
    nombre: "",
    distrito: "",
    whatsapp: "",
    correo: "",
    direccion: "",
  });
  const [affiliateBusy,setAffiliateBusy]=useState(false);
  const [selectedShop, setSelectedShop] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(AVAILABLE_DATES[0]);
  const [selectedTime, setSelectedTime] = useState("");
  const [showAffiliateForm, setShowAffiliateForm] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [requestSaved, setRequestSaved] = useState(false);
  const [barberLogin, setBarberLogin] = useState({ email: "", password: "" });
  const [notificaciones, setNotificaciones] = useState([]);
  const [ultimaNoti, setUltimaNoti] = useState(null);
  const [customRequest, setCustomRequest] = useState("");
  const [customerInfo, setCustomerInfo] = useState({ name: "", phone: "" });
  const [heroIndex, setHeroIndex] = useState(0);
  const cargarBarberiasActivas = async () => {
    setCatalogLoading(true);
    try { const data = await api.catalog(); setShops(data); setCatalogError(''); }
    catch(error) { setCatalogError(error.message); }
    finally{setCatalogLoading(false);}
  };

  useEffect(() => {
    let active=true;
    if(!showBookingModal || !selectedShop || !selectedService) return;
    setAgendaLoading(true);setAgendaError('');setActiveSlots([]);
    const refreshSlots=()=>api.slots(selectedShop.id,selectedService.id,selectedDate).then(rows => {if(active){setActiveSlots(rows);setSelectedTime(current=>rows.some(s=>s.time===current)?current:"");}})
      .catch(error=>{if(active)setAgendaError(error.message);}).finally(()=>{if(active)setAgendaLoading(false);});
    refreshSlots();const timer=setInterval(refreshSlots,5000);
    return()=>{active=false;clearInterval(timer);};
  },[showBookingModal,selectedShop,selectedService,selectedDate]);

useEffect(() => {
  cargarBarberiasActivas();
}, []);
useEffect(() => {
  if (notificaciones.length > 0) {
    const nueva = notificaciones[0];

    if (!ultimaNoti || ultimaNoti.id !== nueva.id) {
      setUltimaNoti(nueva);

      const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
      audio.play().catch(() => {});
    }
  }
}, [notificaciones, ultimaNoti]);
useEffect(() => {
  if (view === "barber") {
    cargarNotificaciones();

    const interval = setInterval(() => {
      cargarNotificaciones();
    }, 3000);

    return () => clearInterval(interval);
  }
}, [view]);
  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 6000);

    return () => clearInterval(timer);
  }, []);

  const ranking = useMemo(
    () => selectShops(shops, { query, district, order, location }),
    [shops, query, district, order, location]
  );

  const markers = useMemo(() => catalogMarkers(ranking), [ranking]);

async function cargarNotificaciones() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) return;

  const { data, error } = await supabase
    .from("notificaciones")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!error) {
    setNotificaciones(data);

  }
}
  const handleAffiliateSubmit = async () => {
    if(affiliateBusy)return;setAffiliateBusy(true);
    try {await api.registerShop(affiliateForm);await identity.refresh();setShowAffiliateForm(false);alert('Barbería registrada. Pendiente de revisión; todavía no está activa.');setView('shop-manage');}
    catch(error){alert(error.message);}
    finally{setAffiliateBusy(false);}
  };

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
    setSelectedShop(shop);
    setShowProfileModal(true);
  };

  const closeProfileModal = () => setShowProfileModal(false);

  const openBookingModal = (shop) => {
    setSelectedShop(shop);
    setSelectedService(shop.services[0]);
    setSelectedDate(AVAILABLE_DATES[0]);
    setSelectedTime("");
    setCustomRequest("");
    setCustomerInfo(prev=>({...prev,name:prev.name||identity.profile?.nombre||"",phone:prev.phone||identity.profile?.telefono||""}));
    setRequestSaved(false);
    setShowBookingModal(true);
  };

  const closeBookingModal = () => {
    setShowBookingModal(false);
    setSelectedTime("");
    setRequestSaved(false);
  };

  const requireBookingLogin=()=>{try{saveDraft(sessionStorage,{shop:selectedShop.id,service:selectedService.id,date:selectedDate,time:selectedTime,name:customerInfo.name,phone:customerInfo.phone,note:customRequest});setShowBookingModal(false);openLogin('client');}catch(error){setAccessMessage(error.message);}};
  useEffect(()=>{const url=new URL(window.location.href);if(url.searchParams.get('auth_callback')!=='1'||identity.loading)return;if(identity.profile){const destination=consumeAccess(sessionStorage);url.searchParams.delete('auth_callback');window.history.replaceState(null,'',url.pathname+url.search+url.hash);setView(accessView(destination,identity.profile.rol));}else{setAccessMessage('Google no completó el acceso. Tu reserva sigue guardada: puedes reintentar o continuar con correo.');setView('client-login');}},[identity.loading,identity.profile]);
  const openLogin=destination=>{setLoginDestination(destination);setView('client-login');};
  const handleGoogle=async()=>{setAccessMessage('');try{rememberAccess(sessionStorage,view==='admin'?'admin':['barber','barber-login'].includes(view)?'barber':view==='client-login'?loginDestination:'client');await beginGoogle(supabase,{enabled:googleAuthEnabled,origin:window.location.origin});}catch(error){setAccessMessage(error.message);}};
  useEffect(()=>{if(adminAccess&&['barber','barber-login'].includes(view))setView('admin');},[adminAccess,view]);
  useEffect(()=>{
    const profile=identity.profile;if(!profile||resumed.current===profile.id)return;
    if(new URLSearchParams(window.location.search).get('cita')){resumed.current=profile.id;setView('my-bookings');return;}
    const draft=readDraft(sessionStorage);if(!draft||profile.rol!=='cliente')return;
    let active=true;
    api.catalog().then(catalog=>{if(!active)return;const shop=catalog.find(s=>String(s.id)===draft.shop),service=shop?.services.find(s=>String(s.id)===draft.service);if(!shop||!service)throw Error('El servicio ya no está disponible. Elige otro.');setSelectedShop(shop);setSelectedService(service);setSelectedDate(draft.date);setSelectedTime(draft.time);setCustomRequest(draft.note);setCustomerInfo(prev=>({...prev,name:draft.name||profile.nombre||'',phone:draft.phone||profile.telefono||''}));resumed.current=profile.id;setView('client');setShowBookingModal(true);clearDraft(sessionStorage);setAccessMessage('Recuperamos tu reserva. Revisa el horario y completa solo los datos que faltan.');}).catch(error=>{if(active)setAccessMessage(error.message);});
    return()=>{active=false;};
  },[identity.profile]);
  const submitReservation = async () => {
    if(!reservationsEnabled){requireBookingLogin();return;}
    if (savingReservation || !selectedTime || !selectedService) return;
    setSavingReservation(true);
    setRequestSaved(false);
    try {
      await api.request({shop:selectedShop.id,service:selectedService.id,start:selectedTime,name:customerInfo.name,phone:customerInfo.phone,note:customRequest});
      // Notification is written in the same database transaction, never by the browser.
      setRequestSaved(true);
      clearDraft(sessionStorage);setShowBookingModal(false);setView("my-bookings");
    } catch (error) { alert(error.message); }
    finally { setSavingReservation(false); }
  };

  const handleLogout = async () => {
    try {
      await disableBookingPush(api).catch(()=>{});
      await endSession(supabase, () => {setNotificaciones([]);setUltimaNoti(null);setCustomerInfo({name:'',phone:''});setBarberLogin({email:'',password:''});clearDraft(sessionStorage);resumed.current='';setView('landing');});
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
      const profile=await signInWithProfile(supabase,barberLogin,['admin','barbero']);await identity.refresh();setBarberLogin(prev=>({...prev,password:''}));setView(profile.rol==='admin'?'admin':'barber');
    }catch(error){alert(error.message);}
  };
  const handleCustomerLogin = async () => {
    if(!customerInfo.email||!customerInfo.password)return alert('Ingresa correo y contraseña');
    try{const profile=await signInWithProfile(supabase,{email:customerInfo.email,password:customerInfo.password},['cliente','barbero','admin']);await identity.refresh();setCustomerInfo(prev=>({...prev,password:''}));setView(accessView(loginDestination,profile.rol));}
    catch(error){alert(error.message);}
  };

  const basePrice =
  (selectedService?.price || selectedShop?.basePrice || 0);



const finalPrice = basePrice;
  if(view === 'account-security')return identity.profile?<AdminMfa client={supabase} onVerified={async()=>{await identity.refresh();setAccessMessage('Authenticator verificado por Supabase. Tu rol no cambia. Registra un segundo factor en otro dispositivo para recuperación.');setView('client');}} onBack={()=>setView('client')}/>:<div className="min-h-screen bg-neutral-950 p-8 text-white"><button onClick={()=>setView('client-login')}>Iniciar sesión para proteger mi cuenta</button></div>;
  if(view === 'shop-manage') return <ShopManagement api={api} profile={identity.profile} onLogin={()=>setView('barber-login')} onBack={async()=>{await cargarBarberiasActivas();setView('client');}} onRegister={()=>{setShowAffiliateForm(true);setView('client');setTimeout(()=>document.getElementById('register-shop')?.scrollIntoView(),0);}}/>;
  if(view === 'my-bookings') return <div className="min-h-screen bg-neutral-950 p-6 text-white"><div className="mx-auto max-w-5xl space-y-5"><h1 className="text-3xl font-black">Mis citas <span className="text-amber-400">MERYO</span></h1><button onClick={()=>setView('client')} className="rounded-xl border border-white/20 px-4 py-2">Volver</button><Reservations key={`${identity.profile?.id}-${identity.profile?.rol}`} api={api} profile={identity.profile} onLogin={()=>setView('client-login')} onSearch={()=>{setQuery('');setDistrict('');setShowBookingModal(false);setView('client');}}/></div></div>;
  if (view === "landing") {
    return (
      <div className="min-h-screen bg-neutral-950 text-white">
        <section
          className="relative overflow-hidden border-b border-white/10 bg-cover bg-center"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1800&q=80)",
          }}
        >
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative mx-auto max-w-6xl px-6 py-28 text-center">
            <span className="mb-6 inline-block rounded-full border border-amber-400/30 bg-amber-400/10 px-5 py-2 text-xs tracking-[0.25em] text-amber-300">
              EXPERIENCIA PREMIUM EN BARBERÍAS
            </span>
            <h1 className="text-5xl font-black leading-tight md:text-7xl">
              El estilo no se improvisa.
              <br />
              <span className="text-amber-400">Se reserva.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-300">
              Encuentra a los mejores barberos cerca de ti, descubre su trabajo real, revisa reseñas y reserva tu cita en segundos con MERYO.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <button
  onClick={() => setView("client")}
  className="rounded-2xl bg-amber-400 px-8 py-4 font-bold text-black hover:scale-105 transition"
>
  Buscar barbería
</button>

<button
  onClick={() => setView("barber-login")}
  className="rounded-2xl border border-white/20 px-8 py-4 font-bold text-white hover:bg-white/10 transition"
>
  Soy barbero
</button>
            </div>
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur">
                <p className="text-2xl font-black text-amber-400">Catálogo</p>
                <p className="text-sm text-neutral-400">Perfiles y servicios</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur">
                <p className="text-2xl font-black text-amber-400">En línea</p>
                <p className="text-sm text-neutral-400">Solicitudes de cita</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur">
                <p className="text-2xl font-black text-amber-400">3 pasos</p>
                <p className="text-sm text-neutral-400">Buscar · Reservar · Cortar</p>
              </div>
            </div>
            <div className="mt-8 flex justify-center gap-5 text-xs text-neutral-400"><a href="/privacidad.html" className="hover:text-amber-400">Privacidad</a><a href="/condiciones.html" className="hover:text-amber-400">Condiciones</a></div>
          </div>
        </section>
      </div>
    );
  }

  if (view === "barber" || view === "barber-login") {
    if (!barberLoggedIn) {
      return (
        <div className="min-h-screen bg-neutral-950 p-8 text-white">
          <div className="mx-auto mt-12 max-w-md rounded-[2rem] border border-white/10 bg-neutral-900 p-8 shadow-2xl">
            <p className="text-sm uppercase tracking-[0.2em] text-amber-400">Acceso barbero</p>
            <h1 className="mt-2 text-3xl font-black">Login MERYO</h1>
            <p className="mt-3 text-sm text-neutral-400">Ingresa con tu cuenta de barbero. Los permisos se verifican con tu cuenta existente.</p>
            <button onClick={handleGoogle} className="mt-4 w-full rounded-xl border border-white/20 p-3">Continuar con Google</button>
            {accessMessage&&<p role="status" className="mt-3 text-amber-300">{accessMessage}</p>}
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
        <h1 className="mb-2 text-3xl font-black">Panel Barbero <span className="text-amber-400">MERYO</span></h1>
        <p className="mb-6 text-neutral-400">Aceptación manual en 15 minutos. El estado y los vencimientos los determina el servidor.</p>
        {notificaciones.length>0&&<div className="mb-5 rounded-2xl border border-white/10 bg-neutral-900 p-5"><h2 className="font-bold">Notificaciones</h2>{notificaciones.slice(0,3).map(n=><p key={n.id} className="mt-2 text-sm text-neutral-300">{n.titulo}</p>)}</div>}
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
            Reserva, califica y habla con tu barbero.
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
if (view === "admin" && adminAccess) return <AdminShops api={api} onSecurity={()=>setAdminSecurityOpen(true)} onLogout={handleLogout} onBack={()=>setView('client')} onChanged={cargarBarberiasActivas}/>;
  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-neutral-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <span className="text-3xl font-black">MER<span className="text-amber-400">YO</span></span>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setView("landing")} className={`rounded-xl border border-white/20 px-4 py-2 text-sm ${pointerClass}`}>Inicio</button>
            <button onClick={() => setView(adminAccess?'admin':"barber")} className={`rounded-xl border border-white/20 px-4 py-2 text-sm ${pointerClass}`}>{adminAccess?'Panel Administrador':'Panel Barbero'}</button>
            <button onClick={()=>setView('my-bookings')} className="rounded-xl border border-white/20 px-4 py-2 text-sm">Mis citas</button>
            <button onClick={()=>setView('shop-manage')} className="rounded-xl border border-white/20 px-4 py-2 text-sm">Mi barbería</button>
            <button onClick={()=>setView(identity.profile?'account-security':'client-auth')} className="rounded-xl border border-white/20 px-4 py-2 text-sm">Mi cuenta</button>
            {adminAccess&&<button onClick={()=>setView('admin')} className="rounded-xl border border-white/20 px-4 py-2 text-sm">Administración</button>}

            <button onClick={handleLogout} className="rounded-xl border border-white/20 px-4 py-2 text-sm">Cerrar sesión</button>
            <button onClick={enableLocation} className={`rounded-xl bg-amber-400 px-4 py-2 font-semibold text-black ${pointerClass}`}>Usar ubicación</button>
          </div>
        </div>
      </header>

      <main>
        {supabase.authUnavailable&&<p role="status" className="mx-auto max-w-7xl px-6 pt-5 text-amber-300">Puedes consultar perfiles, servicios y calendario. Registro, acceso y operaciones privadas requieren Supabase Auth de pruebas; no hay sesiones ficticias.</p>}
        {identity.error&&<p role="alert" className="px-6 text-red-300">{identity.error}</p>}
        {accessMessage&&<p role="status" className="px-6 text-amber-300">{accessMessage}</p>}
        {catalogError&&<p role="alert" className="px-6 text-red-300">{catalogError}</p>}
        <section className="mx-auto max-w-7xl px-6 py-16">
          <ClientHero heroIndex={heroIndex} setHeroIndex={setHeroIndex} setView={setView} shops={shops} />

          <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-black">Barberías cerca de ti</h2>
              <CatalogFilters query={query} district={district} order={order} hasLocation={!!location} onQuery={setQuery} onDistrict={setDistrict} onOrder={setOrder} />
              <p className="mt-2 text-neutral-400">Solicita una cita. La confirmación requiere aceptación y verificación del adelanto por el servidor.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-neutral-300">
              {ranking.length} barberías encontradas
            </div>
          </div>

          {locationError && <p role="alert" className="mb-4 text-sm text-amber-300">{locationError}</p>}
          <button onClick={() => setShowMap(value => !value)} aria-expanded={showMap} className="mb-4 rounded-xl border border-white/10 px-4 py-2 text-sm">{showMap ? "Ocultar mapa" : "Ver mapa"}</button>
          {showMap && <div className="mb-10 rounded-3xl border border-white/10 bg-neutral-900 p-6">
            <Suspense fallback={<p role="status">Cargando mapa…</p>}>
              <CatalogMap markers={markers} location={location} onSelect={id => { const shop = shops.find(item => item.id === id); if (shop) openProfileModal(shop); }} />
            </Suspense>
            {markers.length === 0 && <p className="mt-3 text-sm text-neutral-400">No hay ubicaciones verificables para estos resultados.</p>}
          </div>}
          {shops.length > 0 && ranking.length === 0 && <p role="status" className="mb-6 text-neutral-400">No encontramos barberías con esos filtros.</p>}
          <CatalogStatus loading={catalogLoading} error={catalogError} empty={shops.length===0}/>

          <div className="grid gap-6 md:grid-cols-3">
            {ranking.map((shop) => (
              <div key={shop.id} className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-900">
                {shop.image?<img src={shop.image} className="h-56 w-full object-cover" alt={shop.name}/>:<div className="flex h-56 items-center justify-center bg-neutral-950 text-3xl font-black text-amber-400" aria-label="Sin portada publicada">MERYO</div>}
                <div className="p-5">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-bold">{shop.name}</h3>
                      <p className="text-sm text-neutral-400">{shop.district}{shop.km != null ? ` • A ${shop.km.toFixed(1)} km` : ""}</p>
                    </div>
                    {shop.discount && <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-black">{shop.discount}</span>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {shop.tags.map((tag) => <span key={tag} className="rounded-full border border-white/10 px-3 py-1 text-xs text-neutral-300">{tag}</span>)}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span>{shop.reviews>0?`⭐ ${shop.rating} (${shop.reviews})`:'Aún sin reseñas'}</span>
                    <div className="text-right">
                      <p className="font-semibold text-amber-400">{shop.basePrice==null?'Servicios por publicar':`Desde S/ ${shop.basePrice}`}</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-neutral-300">
                    <p className="font-semibold text-white">Servicios:</p>
                    <p className="mt-1">{shop.services.map((service) => `${service.name} (${service.price})`).join(" • ")}</p>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <button onClick={() => openProfileModal(shop)} className={`rounded-xl border border-white/20 bg-black/40 py-3 font-bold text-white hover:bg-black/60 ${pointerClass}`}>Ver barbería</button>
                    <button onClick={() => openBookingModal(shop)} className={`rounded-xl bg-amber-400 py-3 font-bold text-black ${pointerClass}`}>Reservar cita</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-4">
          <div className="rounded-3xl border border-white/10 bg-neutral-900 p-6">
            <Reservations key={`${identity.profile?.id}-${identity.profile?.rol}`} api={api} profile={identity.profile} onLogin={()=>setView('client-login')} onSearch={()=>{setQuery('');setDistrict('');setShowBookingModal(false);setView('client');}}/>
          </div>
        </section>

        <section className="border-y border-white/10 bg-neutral-900 py-16">
          <div className="mx-auto grid max-w-7xl gap-8 px-6 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-neutral-950 p-6">
              <h2 className="text-2xl font-black">Solicita tu cita</h2><p className="mt-3 text-neutral-400">Elige un servicio en el catálogo. El adelanto del 50 % se solicita únicamente después de que el barbero acepte.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-neutral-950 p-6">
              <div className="mb-6 flex items-center justify-between gap-3">
                <div>
                  <h2 id="register-shop" className="text-2xl font-black">Registro de barberías</h2>
                  <p className="mt-2 text-neutral-400">Afíliate y recibe clientes sin depender solo de Instagram o WhatsApp.</p>
                </div>
                <button onClick={() => setShowAffiliateForm((prev) => !prev)} className={`rounded-xl bg-amber-400 px-4 py-2 font-bold text-black ${pointerClass}`}>{showAffiliateForm ? "Ocultar" : "Registrar"}</button>
              </div>
           {showAffiliateForm ? (
  <div className="space-y-3">
    <input
      value={affiliateForm.nombre}
      onChange={(e) =>
        setAffiliateForm((prev) => ({
          ...prev,
          nombre: e.target.value,
        }))
      }
      className="w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 outline-none"
      placeholder="Nombre de barbería"
    />

    <input
      value={affiliateForm.distrito}
      onChange={(e) =>
        setAffiliateForm((prev) => ({
          ...prev,
          distrito: e.target.value,
        }))
      }
      className="w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 outline-none"
      placeholder="Distrito"
    />

    <input
      value={affiliateForm.whatsapp}
      onChange={(e) =>
        setAffiliateForm((prev) => ({
          ...prev,
          whatsapp: e.target.value,
        }))
      }
      className="w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 outline-none"
      placeholder="WhatsApp"
    />

    <input
      value={affiliateForm.correo}
      onChange={(e) =>
        setAffiliateForm((prev) => ({
          ...prev,
          correo: e.target.value,
        }))
      }
      className="w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 outline-none"
      placeholder="Correo"
    />

    <input
      value={affiliateForm.direccion}
      onChange={(e) =>
        setAffiliateForm((prev) => ({
          ...prev,
          direccion: e.target.value,
        }))
      }
      className="w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 outline-none"
      placeholder="Dirección del local"
    />

    <textarea aria-label="Presentación de la barbería" value={affiliateForm.descripcion||''} onChange={e=>setAffiliateForm(prev=>({...prev,descripcion:e.target.value}))} placeholder="Presentación" className="w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3"/>
    <div className="grid grid-cols-2 gap-3">{['lat','lng'].map(key=><input key={key} aria-label={key==='lat'?'Latitud':'Longitud'} type="number" step="any" value={affiliateForm[key]??''} onChange={e=>setAffiliateForm(prev=>({...prev,[key]:e.target.value}))} placeholder={key==='lat'?'Latitud':'Longitud'} className="rounded-xl border border-white/10 bg-neutral-900 px-4 py-3"/>)}</div>
    {!identity.profile&&<p className="text-amber-300">Inicia sesión con una cuenta real antes de registrar tu barbería.</p>}
    <button
      onClick={handleAffiliateSubmit}
      disabled={affiliateBusy}
      className={`w-full rounded-xl bg-white py-3 font-bold text-black ${pointerClass}`}
    >
      {affiliateBusy?'Registrando…':'Registrar barbería'}
    </button>
  </div>
) : (
  <div className="rounded-2xl border border-dashed border-white/10 bg-neutral-900 p-6 text-sm text-neutral-400">
    Activa el registro para mostrar el formulario de afiliación de barberías.
  </div>
)}
              
            </div>
          </div>
        </section>
      </main>

      <ProfileModal
        selectedShop={showProfileModal ? selectedShop : null}
        onClose={closeProfileModal}
        onReserve={() => {
          setShowProfileModal(false);
          openBookingModal(selectedShop);
        }}
      />

      <BookingModal
        selectedShop={showBookingModal ? selectedShop : null}
        selectedService={selectedService}
        setSelectedService={setSelectedService}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        selectedTime={selectedTime}
        setSelectedTime={setSelectedTime}
        customerInfo={customerInfo}
        setCustomerInfo={setCustomerInfo}
        customRequest={customRequest}
        setCustomRequest={setCustomRequest}
        activeSlots={activeSlots}
        finalPrice={finalPrice}
        requestSaved={requestSaved}
        submitReservation={submitReservation}
        closeBookingModal={closeBookingModal}
        savingReservation={savingReservation}
        reservationsEnabled={reservationsEnabled}
        agendaLoading={agendaLoading} agendaError={agendaError} accessMessage={accessMessage} onLogin={requireBookingLogin}
      />

      <footer className="border-t border-white/10 py-6 text-center text-neutral-500">© 2026 MERYO <a href="/privacidad.html" className="ml-4 hover:text-amber-400">Privacidad</a><a href="/condiciones.html" className="ml-4 hover:text-amber-400">Condiciones</a></footer>
    </div>
  );
}
