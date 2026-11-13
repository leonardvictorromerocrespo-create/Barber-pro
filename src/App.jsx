import NotificationAccess from './components/NotificationAccess';
export {default as ProfileModal} from './components/ProfileModal';
export {BookingModal} from './components/BookingModal';
import {visiblePolling} from './lib/visible-polling';
import { endSession, signInWithProfile } from "./lib/operations";
import { supabase, googleAuthEnabled, emailSignupEnabled } from "./lib/supabase";
import { lazy, Suspense, useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { createMeryoApi } from './lib/meryo-api';
import MeryoLogo from './components/MeryoLogo';
import { DEFAULT_THEME_APPEARANCE, themeAppearanceOption } from './lib/theme-appearances';
import { useIdentity } from './lib/useIdentity';
import { PROFILE_PHOTO_TITLE } from './lib/shop-content';
import {disableBookingPush} from './lib/push';
import {bookingLinkIntent} from './lib/booking-origin';
import {saveDraft,readDraft,clearDraft,beginGoogle} from './lib/booking-draft';
import {rememberAccess,consumeAccess,accessView,oauthFailure} from './lib/access-navigation';
import {bookingDestination,bookingIdFromSearch,pickupOrderIdFromSearch} from './lib/booking-link';
import {clearPickupCart,readPickupCart} from './lib/pickup-cart';
import {catalogCountLabel} from './lib/catalog-copy';
import {createCatalogLoader} from './lib/catalog-loader';
import {createProfileRefreshCoordinator} from './lib/profile-refresh';
import {isPublicShopIndexable,isPublicShopPath,publicShopCanonical,publicShopIdFromPath,publicShopUrl} from './lib/public-shop-url.js';
const api = createMeryoApi(supabase);
import { selectShops, catalogMarkers, coordinates } from "./lib/catalog";
import { listaDias,sumarDias } from "./lib/dates";
const PushCenter = lazy(() => import('./components/PushCenter'));
const ShopRegistration = lazy(() => import('./components/ShopRegistration'));
const Reservations = lazy(() => import('./components/Reservations'));
const AdminMfa = lazy(() => import('./components/AdminMfa'));
const AdminShops = lazy(() => import('./components/AdminShops'));
const TeamInvite = lazy(() => import('./components/TeamInvite'));
const ShopManagement = lazy(() => import('./components/management/ShopManagement'));
const LandingPage = lazy(() => import('./components/LandingPage'));
const PublicJobBoard = lazy(() => import('./components/PublicJobBoard'));
const CutPromotions = lazy(() => import('./components/CutPromotions').then(module => ({default: module.CutPromotions})));
const BeautyPromotions = lazy(() => import('./components/BeautyPromotions').then(module => ({default: module.BeautyPromotions})));
const InspirationGallery = lazy(() => import('./components/InspirationGallery'));
const CatalogFox = lazy(() => import('./components/CatalogFox'));
const BarberShortcutIcon = lazy(() => import('./components/BarberShortcutIcon'));
const MeryoHeader = lazy(() => import('./components/MeryoHeader'));
const BarberCatalogHighlights = lazy(() => import('./components/BarberCatalogHighlights'));
const CatalogFilters = lazy(() => import('./components/CatalogFilters'));
const CatalogStatus = lazy(() => import('./components/CatalogStatus'));
const TurnFinder = lazy(() => import('./components/TurnFinder'));
const ProfileModalView = lazy(() => import('./components/ProfileModal'));
const BookingModalView = lazy(() => import('./components/BookingModal').then(module => ({default: module.BookingModal})));
const CatalogMap = lazy(() => import("./components/CatalogMap"));
const StoreModal=lazy(()=>import('./components/store/StoreModal'));
const MyPickupOrders=lazy(()=>import('./components/store/MyPickupOrders'));
const lazyFallback=<main className="min-h-screen bg-neutral-950 p-8 text-white" role="status">Cargando MERYO…</main>;

const pointerClass = "cursor-pointer";
const ALLOWED_VIEWS=['landing','client','jobs','inspiration','promotions','beauty-promotions','client-auth','client-register','client-login','barber','barber-login','admin','account','account-security','shop-manage','shop-register','my-bookings','my-orders','team-invite','notifications'];
const themeStorageKey=category=>`meryo.theme.${category}.mode.v1`;
const themeAppearanceStorageKey=(category,mode='current')=>`meryo.theme.${category}.appearance.${mode}.v1`;
function readThemeMode(category,fallback){
  if(category==='belleza')return fallback;
  try{
    const saved=window.localStorage.getItem(themeStorageKey(category));
    return saved==='light'||saved==='dark'?saved:fallback;
  }catch{return fallback;}
}
function readThemeAppearance(category,mode){
  const fallback=DEFAULT_THEME_APPEARANCE[category]?.[mode]||DEFAULT_THEME_APPEARANCE.barberia[mode];
  if(category==='belleza'&&mode==='light')return fallback;
  try{
    const current=window.localStorage.getItem(themeAppearanceStorageKey(category));
    if(themeAppearanceOption(category,current)?.mode===mode)return current;
    const preferred=window.localStorage.getItem(themeAppearanceStorageKey(category,mode));
    if(themeAppearanceOption(category,preferred)?.mode===mode)return preferred;
  }catch{/* The theme still works when browser storage is unavailable. */}
  return fallback;
}

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
const todayInLima=()=>{
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
export default function BarberProApp() {
 const identity=useIdentity(supabase);
  const [view, setView] = useState(()=>{const raw=typeof window==='undefined'?'':window.location.hash.slice(1);const hash=raw.startsWith('team-invite/')?'team-invite':raw;const search=typeof window==='undefined'?'':window.location.search,access=new URLSearchParams(search).get('access');const fallback=isPublicShopPath(typeof window==='undefined'?'':window.location.pathname)?'client':ALLOWED_VIEWS.includes(hash)?hash:'landing';return bookingDestination(search,access==='barber'?'barber-login':access==='shop-register'?'shop-register':fallback);});
 return <><NotificationAccess api={api} profile={identity.profile} loading={identity.loading} showNavigation={view!=='landing'&&view!=='client'} adminMode={view==='admin'}/><MeryoScreens identity={identity} view={view} setView={setView}/></>;
}
function MeryoScreens({identity,view,setView}) {
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [query, setQuery] = useState("");
  const [district, setDistrict] = useState("");
  const [order, setOrder] = useState("name");
  const [catalogCategory,setCatalogCategory]=useState(()=>new URLSearchParams(typeof window==='undefined'?'':window.location.search).get('catalogo')==='belleza'?'belleza':'barberia');
  const [themeModes,setThemeModes]=useState(()=>({barberia:readThemeMode('barberia','light'),belleza:readThemeMode('belleza','light')}));
  const [themePalettes,setThemePalettes]=useState(()=>({barberia:readThemeAppearance('barberia',readThemeMode('barberia','light')),belleza:readThemeAppearance('belleza',readThemeMode('belleza','light'))}));
  const [themePalettePreferences,setThemePalettePreferences]=useState(()=>({
    barberia:{light:readThemeAppearance('barberia','light'),dark:readThemeAppearance('barberia','dark')},
    belleza:{light:readThemeAppearance('belleza','light'),dark:readThemeAppearance('belleza','dark')},
  }));
  const themeMode=themeModes[catalogCategory]||'light';
  const themeAppearance=themePalettes[catalogCategory]||DEFAULT_THEME_APPEARANCE[catalogCategory]?.[themeMode];
  const persistThemeSelection=(category,mode,appearance)=>{
    try{
      window.localStorage.setItem(themeStorageKey(category),mode);
      window.localStorage.setItem(themeAppearanceStorageKey(category),appearance);
      window.localStorage.setItem(themeAppearanceStorageKey(category,mode),appearance);
    }catch{/* Keep the current-page choice even when storage is unavailable. */}
  };
  const toggleThemeMode=(category=catalogCategory)=>{
    const currentMode=themeModes[category]||'light';
    const nextMode=currentMode==='dark'?'light':'dark';
    const nextAppearance=themePalettePreferences[category]?.[nextMode]||DEFAULT_THEME_APPEARANCE[category]?.[nextMode];
    if(!nextAppearance)return;
    setThemeModes(current=>({...current,[category]:nextMode}));
    setThemePalettes(current=>({...current,[category]:nextAppearance}));
    persistThemeSelection(category,nextMode,nextAppearance);
  };
  const [loginDestination,setLoginDestination]=useState('client');
  const [mobileExploreRequested,setMobileExploreRequested]=useState(false);
  const [locationPath,setLocationPath]=useState(()=>typeof window==='undefined'?'':window.location.pathname);
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
  const [beautyOffers,setBeautyOffers]=useState([]),[beautyOffersLoading,setBeautyOffersLoading]=useState(false),[beautyOffersError,setBeautyOffersError]=useState(''),[beautyOffersNotice,setBeautyOffersNotice]=useState('');
  const beautyOffersRequest=useRef(0);
  const [activeSlots,setActiveSlots] = useState([]);
  const [agendaError,setAgendaError] = useState('');
  const [agendaLoading,setAgendaLoading] = useState(false);
  const [finderExpectedPrice,setFinderExpectedPrice]=useState(null);
  const [reservationValidationMessage,setReservationValidationMessage]=useState('');
  const reservationAttempt=useRef(0);
  const bookingSelectionRef=useRef(null);
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
  const profileRefresh=useRef(null);
  if(!profileRefresh.current)profileRefresh.current=createProfileRefreshCoordinator({fetchCatalog:(category,shopId)=>api.catalog(category,{shopId}),setSelectedShop,setCatalogState});
  const [selectedService, setSelectedService] = useState(null);
  const [selectedInspiration,setSelectedInspiration]=useState(null);
  const [inspirationIssue,setInspirationIssue]=useState('');
  const bookingReturnView=useRef('client');
  const [selectedPromotion,setSelectedPromotion]=useState(null);
  const [selectedBeautyPromotion,setSelectedBeautyPromotion]=useState(null);
  const [salonPromotionError,setSalonPromotionError]=useState('');
  const [salonPriceDecision,setSalonPriceDecision]=useState(null);
  const [selectedBarber,setSelectedBarber]=useState('');
  useEffect(()=>{const eligible=(selectedShop?.equipo??[]).filter(m=>m.servicios?.some(id=>String(id)===String(selectedService?.id)));setSelectedBarber(current=>eligible.some(m=>m.id===current)?current:eligible[0]?.id||'');},[selectedShop,selectedService]);
  const [selectedDate, setSelectedDate] = useState(AVAILABLE_DATES[0]);
  const [selectedTime, setSelectedTime] = useState("");
  bookingSelectionRef.current={shop:String(selectedShop?.id??''),service:String(selectedService?.id??''),barber:String(selectedBarber??''),date:String(selectedDate??''),time:String(selectedTime??'')};
  const bookingOrigin=useRef(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingStartStep,setBookingStartStep]=useState(1);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileAssetsLoading,setProfileAssetsLoading]=useState(false);
  const [profileAssetsError,setProfileAssetsError]=useState('');
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
    if(!showProfileModal||!selectedShop){setProfileAssetsLoading(false);setProfileAssetsError('');return;}
    let active=true;
    const shopId=String(selectedShop.id);
    setProfileAssetsLoading(true);setProfileAssetsError('');
    api.shopAssets(shopId).then(assets=>{
      if(!active)return;
      const cover=assets.find(asset=>asset.kind==='portada'&&asset.url);
      const profile=assets.filter(asset=>asset.kind==='foto'&&asset.title===PROFILE_PHOTO_TITLE&&asset.url).at(-1);
      setSelectedShop(current=>!current||String(current.id)!==shopId?current:{...current,assets,coverImage:cover?.url||current.coverImage,image:cover?.url||current.image,profileImage:profile?.url||null,contentError:''});
    }).catch(error=>{
      if(active)setProfileAssetsError(error.message||'No se pudo cargar el contenido del perfil.');
    }).finally(()=>{if(active)setProfileAssetsLoading(false);});
    return()=>{active=false;};
  },[api,showProfileModal,selectedShop?.id]);
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
  const cargarBarberiasActivas = useCallback(() => catalogLoader.current.load(catalogCategory),[catalogCategory]);
  const cambiarCategoriaCatalogo = useCallback(category => {
    const next=category==='belleza'?'belleza':'barberia';
    if(next!==catalogCategory&&next==='belleza'){
      const defaultAppearance=DEFAULT_THEME_APPEARANCE.belleza.light;
      setThemeModes(current=>({...current,belleza:'light'}));
      setThemePalettes(current=>({...current,belleza:defaultAppearance}));
      setThemePalettePreferences(current=>({...current,belleza:{...current.belleza,light:defaultAppearance}}));
    }
    catalogNavigation.current+=1;
    catalogLoader.current.reset(next);
    setCatalogCategory(next);
    // A navigation can select the same category after invalidating its load.
    setCatalogLoadRevision(revision=>revision+1);
  },[catalogCategory]);

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
  },[catalogCategory,cambiarCategoriaCatalogo,locationPath,setView]);

  useEffect(() => {
    let active=true;
    if(!showBookingModal || !selectedShop || !selectedService || !selectedBarber){setActiveSlots([]);setAgendaLoading(false);return;}
    setAgendaLoading(true);setAgendaError('');setActiveSlots([]);
    const refreshSlots=()=>(selectedPromotion
      ?api.cutPromotionSlots(selectedShop.id,selectedService.id,selectedDate,selectedBarber,selectedPromotion.campaignId)
      :selectedBeautyPromotion
        ?api.beautyPromotionSlots(selectedShop.id,selectedService.id,selectedDate,selectedBarber,selectedBeautyPromotion.id)
      :api.slots(selectedShop.id,selectedService.id,selectedDate,selectedBarber)).then(rows => {if(active){setActiveSlots(rows);const pending=bookingSelectionRef.current?.time;if((finderExpectedPrice!==null||Boolean(selectedInspiration?.id))&&pending&&!rows.some(s=>!s.occupied&&s.time===pending))setReservationValidationMessage('Ese turno dejó de estar disponible. Elige nuevamente un horario actual.');setSelectedTime(current=>rows.some(s=>!s.occupied&&s.time===current)?current:"");}})
      .catch(error=>{if(active){setAgendaError(error.message);setActiveSlots([]);setSelectedTime('');}}).finally(()=>{if(active)setAgendaLoading(false);});
    const reader=visiblePolling(refreshSlots);
    return()=>{active=false;reader.stop();};
  },[showBookingModal,selectedShop,selectedService,selectedDate,selectedBarber,selectedPromotion,selectedBeautyPromotion,finderExpectedPrice,selectedInspiration?.id]);

  useEffect(()=>{
    if(!showBookingModal||!selectedInspiration?.id)return undefined;
    let active=true;const chosen=selectedInspiration;
    api.inspirationById(chosen.id).then(async current=>{
      if(!active)return;
      if(!current){setInspirationIssue('El trabajo de referencia ya no está publicado. Revisa el servicio actual o continúa sin adjuntar la referencia.');return;}
      let issue='';
      if(current.title!==chosen.title||current.catalog_category!==catalogCategory||String(current.barberia_id)!==String(selectedShop?.id)||String(current.service_id)!==String(chosen.service_id)||String(current.member_id)!==String(chosen.member_id)||String(selectedService?.id)!==String(chosen.service_id)||String(selectedBarber)!==String(chosen.member_id)){
        issue='La publicación cambió desde que la elegiste. Revisa el servicio y el profesional actuales antes de continuar.';
      }else if(current.can_request!==true){
        issue='El profesional o el servicio dejó de estar activo o asignado. Puedes continuar sin la referencia y revisar el perfil.';
      }else{
        try{
          const rows=await api.catalog(catalogCategory),shop=rows.find(row=>String(row.id)===String(current.barberia_id));
          const service=shop?.services.find(row=>String(row.id)===String(current.service_id)&&row.bookable);
          if(!service||Math.round(Number(service.price)*100)!==Math.round(Number(chosen.expectedPrice)*100))issue='El precio del servicio cambió desde que elegiste la referencia. Revisa el importe actual antes de continuar.';
        }catch(error){issue=`No pudimos volver a comprobar el servicio. ${error.message||'Reintenta o continúa sin la referencia.'}`;}
      }
      if(!active)return;
      setSelectedInspiration(old=>old?.id===chosen.id&&old.url!==current.url?{...old,url:current.url}:old);
      setInspirationIssue(issue);
    }).catch(error=>{if(active)setInspirationIssue(`No se pudo comprobar el trabajo de referencia. ${error.message||'Continúa solo después de revisar el servicio.'}`);});
    return()=>{active=false;};
  },[showBookingModal,selectedInspiration,selectedShop?.id,selectedService?.id,selectedBarber,catalogCategory]);

useEffect(() => { cargarBarberiasActivas(); }, [cargarBarberiasActivas,catalogLoadRevision]);
  const ranking = useMemo(
    () => selectShops(catalogRows, { query:catalogCategory==='barberia'?'':query, district, order, location }),
    [catalogRows, catalogCategory, query, district, order, location]
  );

  const markers = useMemo(() => catalogMarkers(ranking), [ranking]);

  const handleAffiliateSubmit = async () => {
    if(affiliateBusy)return;setAffiliateBusy(true);setAffiliateError('');
    try {if(affiliateForm.locationConfirmed!==true||!coordinates(affiliateForm))throw Error('Selecciona o confirma la ubicación del local en el mapa.');await api.registerShop(affiliateForm);const profile=await identity.refresh();if(!profile||profile.rol!=='barbero')throw Error('La solicitud se guardó, pero no se pudo actualizar tu sesión. Vuelve a iniciar sesión para consultar su estado.');setView('shop-manage');}
    catch(error){setAffiliateError(error.message);}
    finally{setAffiliateBusy(false);}
  };

  const openCatalogCategory = category => {
    const next=category==='belleza'?'belleza':'barberia';
    const url=new URL(window.location.href);url.pathname='/';url.search='';url.searchParams.set('catalogo',next);url.hash='client';
    window.history.replaceState({},'',url.href);setLocationPath('/');
    cambiarCategoriaCatalogo(next);setQuery('');setDistrict('');setView('client');
  };
  const openBeautyPromotions=()=>{
    const url=new URL(window.location.href);url.pathname='/';url.searchParams.set('catalogo','belleza');url.hash='beauty-promotions';
    window.history.replaceState(window.history.state,'',url.href);setLocationPath('/');
    cambiarCategoriaCatalogo('belleza');setView('beauty-promotions');
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

  const loadBeautyOffers=useCallback(async()=>{
    const request=++beautyOffersRequest.current;
    setBeautyOffersLoading(true);setBeautyOffersError('');setBeautyOffersNotice('');
    try{const offers=await api.beautyPromotionsToday();if(request===beautyOffersRequest.current)setBeautyOffers(offers);}
    catch(error){if(request===beautyOffersRequest.current){setBeautyOffers([]);setBeautyOffersError(error.message||'Error del servidor');}}
    finally{if(request===beautyOffersRequest.current)setBeautyOffersLoading(false);}
  },[]);
  useEffect(()=>{
    if(view!=='beauty-promotions')return undefined;
    void loadBeautyOffers();
    const refresh=()=>{if(document.visibilityState==='visible')void loadBeautyOffers();};
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
    return()=>{beautyOffersRequest.current++;window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[view,loadBeautyOffers]);

  const enableLocation = () => {
    setLocationError("");
    if (!navigator.geolocation) return setLocationError("Este navegador no permite obtener tu ubicación.");
    navigator.geolocation.getCurrentPosition(position => {
      const point = coordinates({ lat: position.coords.latitude, lng: position.coords.longitude });
      if (!point) return setLocationError("No se obtuvo una ubicación válida.");
      setLocation(point); setOrder("distance");
    }, () => setLocationError("No pudimos obtener tu ubicación. Puedes buscar por distrito."), { timeout: 10000 });
  };

  const clearCatalogFilters=()=>{setQuery('');setDistrict('');setOrder('name');setLocation(null);setLocationError('');};

  const openProfileModal = (shop) => {
    const categoryAtOpen=catalogCategory;
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
    void profileRefresh.current.refresh(shop,categoryAtOpen);
  };

  const closeProfileModal = () => {
    profileRefresh.current.invalidate();
    setShowProfileModal(false);setSelectedShop(null);setProfileUnavailable(false);
    if(window.history.state?.meryoProfileModal){window.history.back();return;}
    const url=new URL(window.location.href);url.pathname='/';url.search='';url.searchParams.set('catalogo',catalogCategory);url.hash='client';
    window.history.replaceState({},'',url.href);setLocationPath('/');setView('client');
  };
  const openStoreModal = shop => {setStoreShop(shop);setStoreCategory(catalogCategory);setShowProfileModal(false);setRestoredPickupCart(null);setShowStoreModal(true);};

  const openBookingModal = (shop, turn, options={}) => {
    reservationAttempt.current+=1;
    bookingReturnView.current='client';setSelectedInspiration(null);setInspirationIssue('');
    const service=options.service??turn?.service??(shop.services??[]).find(item=>item.bookable);
    if(!service){setAccessMessage('Este negocio aún no tiene servicios con precio y duración definidos para reservar. Consulta con el negocio si el servicio requiere evaluación.');return;}
    bookingOrigin.current=turn?'turnos_hoy':options.origin??null;
    setSelectedPromotion(null);setPromotionError('');
    setSelectedBeautyPromotion(null);
    setSalonPromotionError('');setSalonPriceDecision(null);
    setFinderExpectedPrice(turn?Number(turn.service.price):null);setReservationValidationMessage('');
    setSelectedShop(shop);
    setSelectedService(service);
    setSelectedBarber(turn?.member.id??'');
    setSelectedDate(turn?.date??AVAILABLE_DATES[0]);
    setActiveSlots([]);setAgendaError('');
    setSelectedTime(turn?.slot.time??"");
    setBookingStartStep(options.startStep??(turn?3:1));
    setCustomRequest("");
    setCustomerInfo(prev=>({...prev,name:prev.name||identity.profile?.nombre||"",phone:prev.phone||identity.profile?.telefono||""}));
    setRequestSaved(false);
    setShowBookingModal(true);
  };

  const openTaggedBooking=useEffectEvent((shop,origin)=>{
    setShowProfileModal(false);
    openBookingModal(shop,null,{origin});
  });
  useEffect(()=>{
    if(view!=='client'||!showProfileModal||showBookingModal||!selectedShop?.services?.some(service=>service.bookable))return;
    const url=new URL(window.location.href);
    const intent=bookingLinkIntent(url.pathname,url.search);
    if(!intent||intent.shopId!==String(selectedShop.id))return;
    url.searchParams.delete('reservar');url.searchParams.delete('origen');
    window.history.replaceState(window.history.state,'',url.href);
    openTaggedBooking(selectedShop,intent.source);
  },[view,locationPath,showProfileModal,showBookingModal,selectedShop]);

  const openInspirationProfile=async item=>{
    const category=item.catalog_category==='belleza'?'belleza':'barberia';
    const catalog=await api.catalog(category);
    const shop=catalog.find(row=>String(row.id)===String(item.barberia_id));
    if(!shop)throw new Error('El negocio ya no está publicado en este catálogo.');
    cambiarCategoriaCatalogo(category);
    const destination=new URL(publicShopUrl(shop,category,window.location.origin));destination.hash='client';
    const previous=`${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.history.pushState({...window.history.state,meryoProfileModal:true,meryoCatalogPath:previous},'',destination.href);
    setLocationPath(destination.pathname);setSelectedShop(shop);setShowProfileModal(true);setProfileUnavailable(false);setView('client');
  };

  const openInspirationBooking=async item=>{
    if(item.can_request!==true||!item.member_id||!item.service_id)throw new Error('Este trabajo no tiene un servicio y profesional reservables. Puedes visitar el perfil del negocio.');
    const category=item.catalog_category==='belleza'?'belleza':'barberia';
    const catalog=await api.catalog(category);
    const shop=catalog.find(row=>String(row.id)===String(item.barberia_id));
    const service=shop?.services.find(row=>String(row.id)===String(item.service_id)&&row.bookable);
    const member=shop?.equipo?.find(row=>String(row.id)===String(item.member_id)&&row.servicios?.some(id=>String(id)===String(item.service_id)));
    if(!shop||!service||!member)throw new Error('El servicio o profesional dejó de estar disponible. Revisa el perfil antes de reservar.');
    reservationAttempt.current+=1;bookingOrigin.current=null;bookingReturnView.current='inspiration';cambiarCategoriaCatalogo(category);
    setSelectedPromotion(null);setPromotionError('');setSelectedBeautyPromotion(null);setSalonPromotionError('');setSalonPriceDecision(null);
    setFinderExpectedPrice(null);setReservationValidationMessage('');setInspirationIssue('Comprobando el trabajo, el servicio y el precio…');
    setSelectedInspiration({...item,expectedPrice:Number(service.price)});setSelectedShop(shop);setSelectedService(service);setSelectedBarber(member.id);
    setSelectedDate(AVAILABLE_DATES[0]);setSelectedTime('');setBookingStartStep(2);setActiveSlots([]);setAgendaError('');setCustomRequest('');
    setCustomerInfo(current=>({...current,name:current.name||identity.profile?.nombre||'',phone:current.phone||identity.profile?.telefono||''}));
    setRequestSaved(false);setShowProfileModal(false);setView('client');setShowBookingModal(true);
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
      bookingOrigin.current=null;bookingReturnView.current='client';setSelectedInspiration(null);setInspirationIssue('');cambiarCategoriaCatalogo('barberia');setSelectedShop(shop);setSelectedService(service);setSelectedBarber(slot.barber_id);setSelectedDate(slot.date);setSelectedTime(slot.start);setCustomRequest('');
      setCustomerInfo(current=>({...current,name:current.name||identity.profile?.nombre||'',phone:current.phone||identity.profile?.telefono||''}));
      setSelectedPromotion({campaignId:currentOffer.campaign_id,regularPrice:Number(currentOffer.regular_price),promoPrice:Number(currentOffer.promo_price),serviceId:service.id,shopId:shop.id});
      setSelectedBeautyPromotion(null);setSalonPromotionError('');setSalonPriceDecision(null);
       setBookingStartStep(3);setRequestSaved(false);setShowBookingModal(true);
    }catch(error){setCutOffersNotice(error.message||'No se pudo actualizar esta promoción. Inténtalo de nuevo.');}
  };

  const openBeautyOffer=async offer=>{
    setBeautyOffersNotice('');setBeautyOffersError('');setAgendaError('');
    try{
      const currentOffers=await api.beautyPromotionsToday();setBeautyOffers(currentOffers);
      const current=currentOffers.find(row=>String(row.promotion_id)===String(offer.promotion_id)&&String(row.shop_id)===String(offer.shop_id)&&String(row.service_id)===String(offer.service_id));
      if(!current){setBeautyOffersNotice('La promoción o sus turnos ya no están disponibles. La lista se actualizó.');return;}
      const slot=current.slots?.[0];
      if(!slot){setBeautyOffersNotice('La promoción ya no tiene turnos reservables para hoy.');return;}
      const catalog=await api.catalog('belleza');
      const shop=catalog.find(row=>String(row.id)===String(current.shop_id));
      const service=shop?.services.find(row=>String(row.id)===String(current.service_id)&&row.bookable);
      if(!shop||!service)throw Error('El salón o el servicio ya no están publicados. Actualiza las promociones.');
      const promotionDate=slot.date||todayInLima();
      bookingOrigin.current=null;bookingReturnView.current='client';setSelectedInspiration(null);setInspirationIssue('');cambiarCategoriaCatalogo('belleza');setSelectedShop(shop);setSelectedService(service);setSelectedBarber(slot.barber_id);
      setSelectedDate(promotionDate);setSelectedTime(slot.start);setCustomRequest('');
      setCustomerInfo(value=>({...value,name:value.name||identity.profile?.nombre||'',phone:value.phone||identity.profile?.telefono||''}));
      setSelectedPromotion(null);setPromotionError('');setSelectedBeautyPromotion({id:current.promotion_id,regularPrice:Number(current.regular_price),promoPrice:Number(current.promo_price),serviceId:service.id,shopId:shop.id,promotionDate});
       setSalonPromotionError('');setSalonPriceDecision(null);setBookingStartStep(3);setRequestSaved(false);setShowBookingModal(true);
    }catch(error){setBeautyOffersNotice(error.message||'No se pudo actualizar esta promoción. Inténtalo de nuevo.');}
  };

  const continueAtRegularPrice=()=>{
    setSelectedPromotion(null);setSelectedTime('');setPromotionError('La oferta solo aplica a sus horarios participantes. El precio habitual indicado ahora es el que se usará.');
  };

  const closeBookingModal = () => {
    reservationAttempt.current+=1;
    bookingOrigin.current=null;
    setShowBookingModal(false);
    setSelectedTime("");
    setRequestSaved(false);
    setSelectedPromotion(null);setPromotionError('');
    setSelectedBeautyPromotion(null);setSalonPromotionError('');setSalonPriceDecision(null);
    setFinderExpectedPrice(null);setReservationValidationMessage('');
    if(bookingReturnView.current==='inspiration'&&selectedInspiration){setView('inspiration');}
    else{setSelectedInspiration(null);setInspirationIssue('');}
  };

  const continueWithoutInspiration=()=>{
    const expected=Number(selectedService?.price);
    setSelectedInspiration(null);setInspirationIssue('');
    setFinderExpectedPrice(Number.isFinite(expected)&&expected>0?expected:null);
    setReservationValidationMessage('La referencia no se adjuntará. Revisa el servicio y el precio actuales; conserva tu fecha, profesional y hora.');
  };

  const requireBookingLogin=()=>{try{saveDraft(sessionStorage,{origin:bookingOrigin.current,shop:selectedShop.id,service:selectedService.id,barber:selectedBarber,category:catalogCategory,date:selectedDate,time:selectedTime,name:customerInfo.name,phone:customerInfo.phone,note:customRequest,campaignId:selectedPromotion?.campaignId,regularPrice:selectedPromotion?.regularPrice,salonPromotionId:selectedBeautyPromotion?.id,salonRegularPrice:selectedBeautyPromotion?.regularPrice,salonPromoPrice:selectedBeautyPromotion?.promoPrice,turnFinder:finderExpectedPrice!==null,finderExpectedPrice,inspirationPublicationId:selectedInspiration?.id,inspirationExpectedPrice:finderExpectedPrice??selectedInspiration?.expectedPrice,inspirationTitle:selectedInspiration?.title});reservationAttempt.current+=1;setShowBookingModal(false);openLogin('client');}catch(error){setAccessMessage(error.message);}};
  useEffect(()=>{
    const url=new URL(window.location.href),failure=oauthFailure(url);if(identity.loading||(!failure&&url.searchParams.get('auth_callback')!=='1'))return;
    const saved=consumeAccess(sessionStorage),access=url.searchParams.get('access'),destination=['barber','shop-register'].includes(access)?access:saved;
    for(const key of ['auth_callback','access','error','error_code','error_description'])url.searchParams.delete(key);
    window.history.replaceState(null,'',url.pathname+url.search+url.hash);
    if(failure){setAccessMessage(failure);setLoginDestination(bookingDestination(url.search,destination));setView(['barber','shop-register'].includes(destination)?'shop-register':destination==='admin'?'admin':'client-login');return;}
    if(identity.profile){setView(bookingDestination(url.search,accessView(destination,identity.profile.rol)));}
    else{setLoginDestination(bookingDestination(url.search,destination));setAccessMessage(identity.error||'Google no completó el acceso. Puedes reintentar o continuar con correo; conservaremos tu destino.');setView(['barber','shop-register'].includes(destination)?'shop-register':'client-login');}
  },[identity.loading,identity.profile,setView]);
  const openLogin=destination=>{setLoginDestination(destination);setView('client-login');};
  const handleGoogle=async override=>{setAccessMessage('');try{const destination=typeof override==='string'?override:view==='team-invite'?'team-invite':view==='admin'?'admin':view==='shop-register'?'shop-register':['barber','barber-login'].includes(view)?'barber':view==='client-login'?loginDestination:'client';rememberAccess(sessionStorage,destination);await beginGoogle(supabase,{enabled:googleAuthEnabled,origin:window.location.origin,bookingId:new URLSearchParams(window.location.search).get('cita'),orderId:new URLSearchParams(window.location.search).get('pedido'),adminView:new URLSearchParams(window.location.search).get('admin_view'),destination});}catch(error){setAccessMessage(error.message);}};
  useEffect(()=>{if(identity.profile&&['barber','barber-login','shop-register'].includes(view)){const next=accessView(view==='shop-register'?'shop-register':'barber',identity.profile.rol);if(next!==view)setView(next);}},[identity.profile,view,setView]);
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
    api.catalog(draft.category).then(async catalog=>{if(!active||navigationAtStart!==catalogNavigation.current)return;const shop=catalog.find(s=>String(s.id)===draft.shop),service=shop?.services.find(s=>String(s.id)===draft.service);if(!shop||!service?.bookable)throw Error('El servicio ya no está disponible para reservar. Consulta si requiere evaluación.');let promotion=null,beautyPromotion=null,priceDecision=null;if(draft.campaignId){const offers=await api.cutPromotions(),offer=offers.find(row=>String(row.campaign_id)===draft.campaignId&&String(row.service_id)===draft.service);if(!offer||Number(offer.regular_price)!==Number(draft.regularPrice)){clearDraft(sessionStorage);setView('promotions');setAccessMessage('El precio o la disponibilidad de la oferta cambió. Revisa las promociones actuales antes de continuar.');resumed.current=profile.id;return;}promotion={campaignId:draft.campaignId,regularPrice:Number(offer.regular_price),promoPrice:Number(offer.promo_price),serviceId:service.id,shopId:shop.id};}if(draft.salonPromotionId){const offer=service.beautyPromotion;if(offer&&String(offer.id)===String(draft.salonPromotionId)&&Number(offer.regularPrice)===Number(draft.salonRegularPrice)&&Number(offer.promoPrice)===Number(draft.salonPromoPrice)){beautyPromotion={id:offer.id,regularPrice:Number(offer.regularPrice),promoPrice:Number(offer.promoPrice),serviceId:service.id,shopId:shop.id,promotionDate:draft.date};}else{priceDecision={regularPrice:Number(service.price)};setAccessMessage('La promoción del salón venció o cambió mientras iniciabas sesión. Revisa el precio habitual antes de continuar.');}}bookingOrigin.current=draft.origin??null;setSelectedShop(shop);setSelectedService(service);setSelectedPromotion(promotion);setSelectedBeautyPromotion(beautyPromotion);setSalonPriceDecision(priceDecision);setSalonPromotionError('');setSelectedBarber(draft.barber||'');setSelectedDate(draft.date);const finderSelection=draft.turnFinder===true&&draft.finderExpectedPrice!==null&&!promotion&&!beautyPromotion;const finderPriceChanged=finderSelection&&Math.round(Number(service.price)*100)!==Math.round(Number(draft.finderExpectedPrice)*100);setActiveSlots([]);setSelectedTime(finderPriceChanged?'':draft.barber&&!(shop.equipo??[]).some(m=>String(m.id)===String(draft.barber)&&m.servicios?.some(id=>String(id)===String(service.id)))?'':draft.time);setFinderExpectedPrice(finderSelection?Number(service.price):null);setSelectedInspiration(draft.inspirationPublicationId?{id:draft.inspirationPublicationId,title:draft.inspirationTitle||'Trabajo seleccionado',expectedPrice:Number(draft.inspirationExpectedPrice),catalog_category:draft.category,service_id:draft.service,member_id:draft.barber}:null);setInspirationIssue(draft.inspirationPublicationId?'Volviendo a comprobar la publicación, el servicio y el precio…':'');bookingReturnView.current=draft.inspirationPublicationId?'inspiration':'client';setReservationValidationMessage(finderPriceChanged?`El precio habitual cambió de S/ ${Number(draft.finderExpectedPrice).toFixed(2)} a S/ ${Number(service.price).toFixed(2)}. Elige nuevamente un horario para continuar.`:'');setCustomRequest(draft.note);setCustomerInfo(prev=>({...prev,name:draft.name||profile.nombre||'',phone:draft.phone||profile.telefono||''}));resumed.current=profile.id;setView('client');cambiarCategoriaCatalogo(draft.category);setBookingStartStep(draft.time?3:2);setShowBookingModal(true);clearDraft(sessionStorage);if(!priceDecision)setAccessMessage('Recuperamos tu reserva. Revisa el horario y completa solo los datos que faltan.');}).catch(error=>{if(active&&navigationAtStart===catalogNavigation.current)setAccessMessage(error.message);});
    return()=>{active=false;};
  },[identity.profile,cambiarCategoriaCatalogo,setView]);
  const submitReservation = async () => {
    if(identity.loading){setAccessMessage('Restaurando tu sesión. Espera un momento antes de continuar.');return;}
    if(identity.error){setAccessMessage('No pudimos comprobar tu sesión. Reintenta la comprobación antes de iniciar sesión nuevamente.');return;}
    if(!reservationsEnabled){requireBookingLogin();return;}
    if (savingReservation || !selectedTime || !selectedService || !selectedBarber) return;
    const selectionAtStart={shop:String(selectedShop?.id),service:String(selectedService.id),barber:String(selectedBarber),date:String(selectedDate),time:String(selectedTime)};
    const categoryAtStart=catalogCategory==='belleza'?'belleza':'barberia';
    const expectedPriceAtStart=finderExpectedPrice??selectedInspiration?.expectedPrice??null;
    const originAtStart=bookingOrigin.current;
    const attempt=++reservationAttempt.current;
    setSavingReservation(true);
    setRequestSaved(false);
    setReservationValidationMessage('');
    try {
      if(expectedPriceAtStart!==null){
        setReservationValidationMessage('Comprobando de nuevo el precio y el horario…');
        let freshCatalog,freshShop,freshService,freshSlots;
        try{
          freshCatalog=await api.catalog(categoryAtStart);
          if(attempt!==reservationAttempt.current)return;
          freshShop=freshCatalog.find(shop=>String(shop.id)===selectionAtStart.shop);
          freshService=freshShop?.services.find(service=>String(service.id)===selectionAtStart.service&&service.bookable);
          if(!freshShop||!freshService){setSelectedTime('');setReservationValidationMessage('El negocio o el servicio ya no está disponible. Vuelve a consultar el catálogo.');return;}
          freshSlots=await api.slots(selectionAtStart.shop,selectionAtStart.service,selectionAtStart.date,selectionAtStart.barber);
        }catch(error){if(attempt===reservationAttempt.current)setReservationValidationMessage(`No se envió la solicitud porque no pudimos verificar el precio y el horario. ${error.message||'Vuelve a intentarlo.'}`);return;}
        if(attempt!==reservationAttempt.current)return;
        const current=bookingSelectionRef.current;
        if(!current||current.shop!==selectionAtStart.shop||current.service!==selectionAtStart.service||current.barber!==selectionAtStart.barber||current.date!==selectionAtStart.date||current.time!==selectionAtStart.time){setReservationValidationMessage('Tu selección cambió durante la comprobación. Elige nuevamente el horario antes de solicitar.');return;}
        const currentPrice=Number(freshService.price),priceChanged=!Number.isFinite(currentPrice)||Math.round(currentPrice*100)!==Math.round(Number(expectedPriceAtStart)*100);
        if(priceChanged){setSelectedShop(freshShop);setSelectedService(freshService);setActiveSlots(freshSlots);setSelectedTime('');if(selectedInspiration?.id){setInspirationIssue('El precio habitual cambió. Revisa el importe actual y pulsa “Continuar sin esta referencia” para volver a validar la cita.');}else{setFinderExpectedPrice(currentPrice);}setReservationValidationMessage(`El precio habitual cambió de S/ ${Number(expectedPriceAtStart).toFixed(2)} a S/ ${currentPrice.toFixed(2)}. Revisa el nuevo precio y elige nuevamente un horario.`);return;}
        if(!freshSlots.some(slot=>!slot.occupied&&slot.time===selectionAtStart.time)){setActiveSlots(freshSlots);setSelectedTime('');setReservationValidationMessage('Ese horario ya no está disponible. Revisa la agenda actual y elige nuevamente.');return;}
      }
      await api.request({origin:originAtStart,shop:selectedShop.id,service:selectedService.id,barber:selectedBarber,start:selectedTime,name:customerInfo.name,phone:customerInfo.phone,note:customRequest,campaignId:selectedPromotion?.campaignId||null,regularPrice:selectedPromotion?.regularPrice??null,salonPromotionId:selectedBeautyPromotion?.id||null,salonRegularPrice:catalogCategory==='belleza'?Number(selectedService.price):null,salonPromoPrice:selectedBeautyPromotion?.promoPrice??null,finderExpectedPrice,inspirationPublicationId:selectedInspiration?.id||null,inspirationExpectedPrice:selectedInspiration?.expectedPrice??null});
      // Notification is written in the same database transaction, never by the browser.
      setRequestSaved(true);
      window.dispatchEvent(new CustomEvent('meryo-booking-request-saved',{detail:{userId:identity.profile?.id}}));
      clearDraft(sessionStorage);setShowBookingModal(false);setSelectedPromotion(null);setPromotionError('');setSelectedBeautyPromotion(null);setSalonPriceDecision(null);setFinderExpectedPrice(null);setSelectedInspiration(null);setInspirationIssue('');setReservationValidationMessage('');bookingReturnView.current='client';setView("my-bookings");
    } catch (error) {
      if(selectedInspiration?.id&&/trabajo ya no está publicado|foto de referencia|referencia cambió|servicio o profesional de la referencia cambió|precio del servicio cambió|profesional ya no ofrece|servicio de referencia/i.test(error.message||'')){
        setInspirationIssue(error.message||'La referencia cambió. Revisa el servicio actual o continúa sin adjuntarla.');
        setReservationValidationMessage('No se envió la solicitud. Confirma el servicio actual antes de continuar.');
        try{const current=(await api.catalog(categoryAtStart)).find(row=>String(row.id)===selectionAtStart.shop);const service=current?.services.find(row=>String(row.id)===selectionAtStart.service);if(current&&service){setSelectedShop(current);setSelectedService(service);setActiveSlots(await api.slots(current.id,service.id,selectionAtStart.date,selectionAtStart.barber));}else setSelectedTime('');}catch(refreshError){setReservationValidationMessage(`${error.message} No se pudo actualizar el servicio; vuelve a consultar el catálogo.`);}
      }else if(selectedInspiration?.id&&/horario individual no disponible|hora ya fue tomada|horario.*no disponible|coincide con otra cita/i.test(error.message||'')){
        setSelectedTime('');setReservationValidationMessage('Ese horario se ocupó antes de guardar. La referencia se conserva; elige otro horario disponible.');
        try{setActiveSlots(await api.slots(selectedShop.id,selectedService.id,selectedDate,selectedBarber));}catch(refreshError){setAgendaError(refreshError.message);setActiveSlots([]);}
      }else if(selectedPromotion){
        setPromotionError(error.message||'La oferta o el horario dejó de estar disponible. No se cambió el precio.');setSelectedTime('');setAgendaLoading(true);
        try{setActiveSlots(await api.cutPromotionSlots(selectedShop.id,selectedService.id,selectedDate,selectedBarber,selectedPromotion.campaignId));}catch{setActiveSlots([]);}
        finally{setAgendaLoading(false);}
      }else if(catalogCategory==='belleza'&&(/oferta del salón|precio (?:habitual|promocional)|oferta venció|oferta.*cambió/i.test(error.message||''))){
        setSalonPromotionError(error.message||'La oferta o el precio cambió.');
        setSelectedTime('');
        try{
          const fresh=(await api.catalog('belleza')).find(shop=>String(shop.id)===String(selectedShop.id));
          const currentService=fresh?.services.find(service=>String(service.id)===String(selectedService.id)&&service.bookable);
          if(currentService){
            setSelectedShop(fresh);setSelectedService(currentService);setSelectedBeautyPromotion(null);
            setSalonPriceDecision({regularPrice:Number(currentService.price)});
            setActiveSlots(await api.slots(fresh.id,currentService.id,selectedDate,selectedBarber));
          }else{setSelectedBeautyPromotion(null);setSalonPriceDecision(null);setActiveSlots([]);setSalonPromotionError('La oferta o el servicio ya no están disponibles. No se cambió el precio; vuelve a consultar el catálogo.');}
        }catch(refreshError){setActiveSlots([]);setSalonPriceDecision(null);setSalonPromotionError(`${error.message} No pudimos actualizar el servicio; pulsa Reintentar en la agenda.`);}
      }else if(catalogCategory==='belleza'&&/turno.*(?:disponible|cambió)/i.test(error.message||'')){
        setSalonPromotionError(error.message||'Ese turno ya no está disponible. Elige otro horario.');setSelectedTime('');setAgendaLoading(true);
        try{setActiveSlots(await api.slots(selectedShop.id,selectedService.id,selectedDate,selectedBarber));}catch{setActiveSlots([]);}
        finally{setAgendaLoading(false);}
      }else if(expectedPriceAtStart!==null&&/precio.*cambi|precio esperado/i.test(error.message||'')){
        setSelectedTime('');setReservationValidationMessage('El precio habitual cambió mientras comprobábamos el turno. Actualiza la agenda y elige nuevamente antes de solicitar.');
        try{const freshCatalog=await api.catalog(categoryAtStart),freshShop=freshCatalog.find(shop=>String(shop.id)===selectionAtStart.shop),freshService=freshShop?.services.find(service=>String(service.id)===selectionAtStart.service&&service.bookable);if(freshShop&&freshService){setSelectedShop(freshShop);setSelectedService(freshService);setFinderExpectedPrice(Number(freshService.price));setActiveSlots(await api.slots(freshShop.id,freshService.id,selectionAtStart.date,selectionAtStart.barber));}}catch(refreshError){setReservationValidationMessage(`No se envió la solicitud. ${refreshError.message||'No se pudo actualizar la agenda.'}`);}
      }else if(expectedPriceAtStart!==null&&/turno.*(?:tomad|disponible)|ya fue tomada|coincide con otra cita/i.test(error.message||'')){
        setSelectedTime('');setReservationValidationMessage('Ese turno fue ocupado antes de guardar la cita. Elige otro horario disponible.');
        try{setActiveSlots(await api.slots(selectedShop.id,selectedService.id,selectedDate,selectedBarber));}catch(refreshError){setAgendaError(refreshError.message);setActiveSlots([]);}
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



const applicableBeautyPromotion=catalogCategory==='belleza'&&selectedBeautyPromotion&&String(selectedBeautyPromotion.shopId)===String(selectedShop?.id)&&String(selectedBeautyPromotion.serviceId)===String(selectedService?.id)&&selectedBeautyPromotion.promotionDate===selectedDate?selectedBeautyPromotion:null;
const finalPrice = selectedPromotion ? Number((basePrice * 0.5).toFixed(2)) : applicableBeautyPromotion ? Number(applicableBeautyPromotion.promoPrice) : basePrice;
  const navigateMobile=destination=>{
    if(destination==='explore'){setMobileExploreRequested(true);setView('client');return;}
    setMobileExploreRequested(false);setView(destination);
  };
  const backToOffers=()=>{closeBookingModal();if(catalogCategory==='belleza'){setView('beauty-promotions');void loadBeautyOffers();}else{setView('promotions');void loadCutOffers();}};
  const selectBookingService=service=>{if(selectedInspiration?.id&&String(service.id)!==String(selectedInspiration.service_id))setInspirationIssue('El servicio elegido ya no coincide con la referencia. Continúa sin la referencia para revisar y reservar el servicio actual.');setSelectedService(service);setFinderExpectedPrice(null);setReservationValidationMessage('');setSelectedBeautyPromotion(null);setSalonPromotionError('');setSalonPriceDecision(null);};
  const selectBookingBarber=memberId=>{if(selectedInspiration?.id&&String(memberId)!==String(selectedInspiration.member_id))setInspirationIssue('El profesional elegido ya no coincide con la referencia. Continúa sin la referencia para revisar y reservar con el profesional actual.');setSelectedBarber(memberId);};
  const selectBookingTime=time=>{setSelectedTime(time);if(time)setReservationValidationMessage('');};
  const confirmSalonRegularPrice=()=>{if(!salonPriceDecision||!activeSlots.some(slot=>slot.time===selectedTime))return;setSalonPriceDecision(null);setSalonPromotionError('');};
 const renderBookingModal=()=> showBookingModal?<Suspense fallback={null}><BookingModalView startStep={bookingStartStep} catalogCategory={catalogCategory} themeMode={themeMode} themeAppearance={themeAppearance} selectedShop={selectedShop} selectedService={selectedService} selectedBarber={selectedBarber} setSelectedBarber={setSelectedBarber} onBarberSelect={selectBookingBarber} setSelectedService={setSelectedService} onServiceSelect={selectBookingService} selectedDate={selectedDate} setSelectedDate={setSelectedDate} selectedTime={selectedTime} setSelectedTime={selectBookingTime} customerInfo={customerInfo} setCustomerInfo={setCustomerInfo} customRequest={customRequest} setCustomRequest={setCustomRequest} activeSlots={activeSlots} finalPrice={finalPrice} requestSaved={requestSaved} submitReservation={submitReservation} closeBookingModal={closeBookingModal} savingReservation={savingReservation} reservationsEnabled={reservationsEnabled} agendaLoading={agendaLoading} agendaError={agendaError} accessMessage={accessMessage} onLogin={requireBookingLogin} identityLoading={identity.loading} identityError={identity.error} onRetrySession={()=>void identity.refresh()} promotion={selectedPromotion} promotionError={promotionError} onRegularPrice={continueAtRegularPrice} onBackToOffers={backToOffers} salonPromotion={applicableBeautyPromotion} salonPromotionError={salonPromotionError} salonPriceDecision={salonPriceDecision} onSalonRegularPrice={confirmSalonRegularPrice} onCancelSalonPriceDecision={closeBookingModal} reservationValidationMessage={reservationValidationMessage} inspiration={selectedInspiration} inspirationIssue={inspirationIssue} onClearInspiration={continueWithoutInspiration}/></Suspense>:null;
  const openProfessional=()=>{if(adminAccess)setView('admin');else if(identity.profile?.rol==='barbero')setView('shop-manage');else if(identity.profile?.rol==='cliente')setView('shop-register');else setView('barber-login');};
   if(view==='inspiration')return <Suspense fallback={lazyFallback}><><InspirationGallery api={api} category={catalogCategory} themeMode={themeMode} themeAppearance={themeAppearance} onToggleTheme={toggleThemeMode} onBack={()=>setView('client')} onViewProfile={openInspirationProfile} onBook={openInspirationBooking} onNavigate={navigateMobile} BottomNav={MobileBottomNav} initialPublication={selectedInspiration} signedIn={Boolean(identity.profile)} loadingIdentity={identity.loading}/>{renderBookingModal()}</></Suspense>;
   if(view==='promotions')return <Suspense fallback={lazyFallback}><><CutPromotions themeMode={themeModes.barberia} themeAppearance={themePalettes.barberia} onToggleTheme={()=>toggleThemeMode('barberia')} offers={cutOffers} loading={cutOffersLoading} error={cutOffersError} notice={cutOffersNotice} onRetry={loadCutOffers} onBack={()=>{cambiarCategoriaCatalogo('barberia');setView('client');}} onOpenOffer={openCutOffer} onNavigate={navigateMobile} bannerImage="/cut-promotions-banner.png" BottomNav={MobileBottomNav}/>{renderBookingModal()}</></Suspense>;
   if(view==='beauty-promotions')return <Suspense fallback={lazyFallback}><><BeautyPromotions themeMode={themeModes.belleza} themeAppearance={themePalettes.belleza} onToggleTheme={()=>toggleThemeMode('belleza')} offers={beautyOffers} loading={beautyOffersLoading} error={beautyOffersError} notice={beautyOffersNotice} onRetry={loadBeautyOffers} onBack={()=>{cambiarCategoriaCatalogo('belleza');setView('client');}} onReserve={openBeautyOffer} onNavigate={navigateMobile} BottomNav={MobileBottomNav}/>{renderBookingModal()}</></Suspense>;
  if(view === 'notifications')return <Suspense fallback={lazyFallback}><PushCenter api={api} profile={identity.profile} loading={identity.loading} onLogin={()=>openLogin('notifications')} onBack={()=>setView('client')}/></Suspense>;
  if(view === 'team-invite')return <Suspense fallback={lazyFallback}><TeamInvite api={api} profile={identity.profile} onGoogle={handleGoogle} onEmail={()=>openLogin('team-invite')} onAccepted={async()=>{await identity.refresh();setView('barber');}} onBack={()=>setView('client')}/></Suspense>;
   if(view==='account')return <main data-meryo-theme={catalogCategory==='belleza'?'beauty':'barberia'} data-meryo-mode={themeMode} data-meryo-appearance={themeAppearance} className="min-h-screen bg-neutral-950 p-4 pb-24 text-white sm:p-6 sm:pb-24 md:pb-6"><div className="mx-auto max-w-3xl space-y-5"><h1 className="text-3xl font-black">Mi cuenta <span className="text-amber-400">MERYO</span></h1><button onClick={()=>setView('client')} className="rounded-xl border border-white/20 px-4 py-2">Volver</button>{identity.loading?<p role="status">Restaurando tu sesión…</p>:identity.error?<div role="alert" className="space-y-3"><p>No pudimos comprobar tu sesión.</p><button type="button" onClick={()=>void identity.refresh()} className="rounded-xl border border-white/20 px-4 py-3">Reintentar</button></div>:identity.profile?<section className="space-y-4 rounded-2xl border border-white/10 bg-neutral-900 p-6"><p>{identity.profile.nombre||'Tu cuenta'}</p><button onClick={()=>setView('my-bookings')} className="block w-full rounded-xl border border-white/20 px-4 py-3 text-left">Mis citas</button>{identity.profile.rol==='barbero'&&<button onClick={()=>setView('barber')} className="block w-full rounded-xl border border-white/20 px-4 py-3 text-left">Panel Profesional</button>}{identity.profile.rol==='barbero'&&<button onClick={()=>setView('shop-manage')} className="block w-full rounded-xl border border-white/20 px-4 py-3 text-left">Mi negocio</button>}{identity.profile.rol==='cliente'&&<button onClick={()=>setView('shop-register')} className="block w-full rounded-xl border border-white/20 px-4 py-3 text-left">Registrar un negocio</button>}{adminAccess&&<button onClick={()=>setView('admin')} className="block w-full rounded-xl border border-white/20 px-4 py-3 text-left">Administración</button>}<button onClick={()=>setView('notifications')} className="block w-full rounded-xl border border-white/20 px-4 py-3 text-left">Notificaciones</button><button onClick={()=>setView('my-orders')} className="block w-full rounded-xl border border-white/20 px-4 py-3 text-left">Mis pedidos de tienda</button><button onClick={()=>setView('account-security')} className="block w-full rounded-xl border border-white/10 px-4 py-3 text-left">Seguridad y recuperación</button><button onClick={handleLogout} className="block w-full rounded-xl border border-white/10 px-4 py-3 text-left">Cerrar sesión</button></section>:<button onClick={()=>openLogin('account')} className="rounded-xl bg-amber-400 px-4 py-3 font-bold text-black">Iniciar sesión</button>}</div><MobileBottomNav active="account" onNavigate={navigateMobile}/></main>;
  if(view === 'account-security')return identity.profile?<Suspense fallback={lazyFallback}><AdminMfa client={supabase} onVerified={async()=>{await identity.refresh();setAccessMessage('Authenticator verificado por Supabase. Tu rol no cambia. Registra un segundo factor en otro dispositivo para recuperación.');setView('client');}} onBack={()=>setView('client')}/></Suspense>:<div className="min-h-screen bg-neutral-950 p-8 text-white"><button onClick={()=>setView('client-login')}>Iniciar sesión para proteger mi cuenta</button></div>;
  const registration=<ShopRegistration profile={identity.profile} loading={identity.loading} form={affiliateForm} setForm={setAffiliateForm} busy={affiliateBusy} error={affiliateError||accessMessage||identity.error} onSubmit={handleAffiliateSubmit} onGoogle={()=>handleGoogle('shop-register')} onLogin={()=>openLogin('shop-register')} onManage={()=>setView('shop-manage')}/>;
  if(view==='shop-register')return <main className="min-h-screen bg-neutral-950 p-6 text-white"><div className="mx-auto max-w-2xl space-y-5 rounded-3xl border border-white/10 bg-neutral-900 p-6"><h1 className="text-3xl font-black">Registro de negocios <span className="text-amber-400">MERYO</span></h1><button onClick={()=>setView('client')} className="rounded-xl border border-white/20 px-4 py-2">Volver al catálogo</button><Suspense fallback={<p role="status">Cargando registro…</p>}>{registration}</Suspense></div></main>;
  if(view === 'shop-manage') return <Suspense fallback={lazyFallback}><ShopManagement key={identity.profile?.id||'anonymous'} api={api} profile={identity.profile} onLogin={()=>openLogin(pickupOrderIdFromSearch(window.location.search)?'shop-order':'barber')} onBack={async()=>{await cargarBarberiasActivas();setView('client');}} onRegister={()=>setView('shop-register')}/></Suspense>;
   if(view==='my-orders') return <div data-meryo-theme={catalogCategory==='belleza'?'beauty':'barberia'} data-meryo-mode={themeMode} data-meryo-appearance={themeAppearance}><Suspense fallback={<p className="min-h-screen bg-neutral-950 p-8 text-white">Cargando pedidos…</p>}><MyPickupOrders api={api} profile={identity.profile} identityLoading={identity.loading} onLogin={destination=>openLogin(destination)} onBack={()=>{const url=new URL(window.location.href);url.searchParams.delete('pedido');window.history.replaceState(null,'',url.pathname+url.search+url.hash);setView('client');}}/></Suspense></div>;
   if(view === 'my-bookings') return <div data-meryo-theme={catalogCategory==='belleza'?'beauty':'barberia'} data-meryo-mode={themeMode} data-meryo-appearance={themeAppearance} className="min-h-screen bg-neutral-950 p-4 pb-24 text-white sm:p-6 sm:pb-24 md:pb-6"><div className="mx-auto max-w-5xl space-y-5"><header className="meryo-bookings-page-header"><MeryoLogo variant={themeMode==='light'?'light':'dark'} className="h-7 w-auto shrink-0"/><button onClick={()=>{const url=new URL(window.location.href);url.searchParams.delete('cita');window.history.replaceState(null,'',url.pathname+url.search+url.hash);setView('client');}} className="hidden rounded-xl border border-white/20 px-4 py-2 sm:inline-flex">Volver al catálogo</button></header>{requestSaved&&identity.profile?.rol==='cliente'&&<section aria-labelledby="meryo-request-saved-title" className="rounded-xl bg-white/5 p-4"><h2 id="meryo-request-saved-title" className="font-bold">Solicitud enviada</h2><p role="status" className="mt-1 text-sm">El negocio tiene hasta 15 minutos para responder. Puedes consultar el estado aquí, en Mis citas.</p></section>}<Suspense fallback={<p role="status">Cargando citas…</p>}><Reservations key={`${identity.profile?.id}-${identity.profile?.rol}`} api={api} profile={identity.profile} identityLoading={identity.loading} identityError={identity.error} onRetrySession={()=>void identity.refresh()} onLogin={()=>openLogin('my-bookings')} onSearch={()=>{const url=new URL(window.location.href);url.searchParams.delete('cita');window.history.replaceState(null,'',url.pathname+url.search+url.hash);setQuery('');setDistrict('');setShowBookingModal(false);setView('client');}}/></Suspense></div><MobileBottomNav active="my-bookings" onNavigate={navigateMobile}/></div>;
  if (view === 'jobs') return <Suspense fallback={lazyFallback}><PublicJobBoard api={api} onBack={()=>setView('landing')}/></Suspense>;

  if (view === "landing") {
    return <Suspense fallback={lazyFallback}><LandingPage setView={setView} onExplore={openCatalogCategory} onFindNearby={category=>{openCatalogCategory(category);enableLocation();}} profile={identity.profile} identityLoading={identity.loading} onSignIn={()=>openLogin('client')} onAccount={()=>setView('account')} onProfessionalAccess={openProfessional} onJobs={()=>setView('jobs')}/></Suspense>;
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
        <Suspense fallback={<p role="status">Cargando citas…</p>}><Reservations key={`${identity.profile?.id}-${identity.profile?.rol}`} api={api} profile={identity.profile} onLogin={()=>setView('barber-login')} onSearch={()=>setView('client')}/></Suspense>
        <div className="mt-10 flex flex-wrap gap-3">
          <button onClick={() => setView("client")} className={`rounded-xl bg-amber-400 px-4 py-2 font-bold text-black ${pointerClass}`}>Volver</button>
          <button onClick={handleLogout} className={`rounded-xl border border-white/10 px-4 py-2 font-bold ${pointerClass}`}>Cerrar sesión</button>
        </div>
      </div>
    );
  }
  if(view === "admin"&&adminAccess&&(!adminAal2||adminSecurityOpen))return <Suspense fallback={lazyFallback}><AdminMfa client={supabase} onVerified={async()=>{await identity.refresh();setAdminAal2(true);setAdminSecurityOpen(false);}} onBack={()=>{setAdminSecurityOpen(false);if(!adminAal2)setView("client");}}/></Suspense>;
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
  const signInButton = 'relative flex min-h-11 w-full cursor-pointer items-center justify-center rounded-md bg-white px-10 py-2 text-center text-[13px] font-normal leading-tight text-[#3c4043] hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white';
  const fieldStyle = 'mt-1.5 w-full rounded-xl border border-white/25 bg-[#13263b] px-4 py-3 text-base text-white placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';
  return (
    <main className="min-h-svh bg-[#0a1523] text-white sm:grid sm:place-items-center sm:p-8">
      <section aria-labelledby="meryo-login-title" className="mx-auto flex min-h-svh w-full max-w-md flex-col overflow-hidden bg-[#1b3149] sm:min-h-0 sm:rounded-[2rem] sm:shadow-2xl">
        <div className="relative isolate flex min-h-64 flex-1 items-center justify-center overflow-hidden bg-[#1b3149] sm:min-h-72">
          <img src="/meryo-login-tijeras.webp" alt="" fetchPriority="high" className="absolute inset-0 -z-20 size-full object-cover object-center"/>
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#13263b]/15 via-[#13263b]/35 to-[#13263b]/80"/>
          <MeryoLogo className="h-auto w-44 drop-shadow-lg sm:w-52"/>
        </div>
        <div className="relative -mt-3 rounded-t-[1.75rem] bg-[#13263b] px-6 pt-7 pb-8 sm:px-9">
          <h1 id="meryo-login-title" className="text-2xl font-semibold tracking-tight">Inicia sesión</h1>
          <p className="mt-1 text-sm text-slate-300">Reserva tu próxima cita con MERYO.</p>
          {accessMessage&&<p role="status" className="mt-4 text-sm text-amber-200">{accessMessage}</p>}
          {supabase.authUnavailable&&<p role="status" className="mt-4 text-sm text-amber-200">Falta conectar Supabase Auth de pruebas. No se admite un acceso simulado.</p>}
          <div className="mt-6 space-y-3">
            <button type="button" onClick={handleGoogle} className={signInButton}>
              <svg aria-hidden="true" viewBox="0 0 48 48" className="absolute left-3.5 size-[19px]">
                <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.9z"/>
                <path fill="#34A853" d="M24 44c5.5 0 10.2-1.8 13.5-4.9l-6.6-5a12.3 12.3 0 0 1-18.3-6.4H5.8v5.2A20 20 0 0 0 24 44z"/>
                <path fill="#FBBC05" d="M12.6 27.7a12 12 0 0 1 0-7.4v-5.2H5.8a20 20 0 0 0 0 17.8z"/>
                <path fill="#EA4335" d="M24 11.9c3 0 5.7 1 7.8 3.1l5.8-5.8A19.4 19.4 0 0 0 24 4 20 20 0 0 0 5.8 15.1l6.8 5.2A12 12 0 0 1 24 11.9z"/>
              </svg>
              Continuar con Google
            </button>
            <details>
              <summary className={signInButton + ' list-none [&::-webkit-details-marker]:hidden'}>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="absolute left-3.5 size-[19px]"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
                Continuar con correo
              </summary>
              <form className="mt-4 space-y-3" onSubmit={event=>{event.preventDefault();handleCustomerLogin();}}>
                <label className="block text-sm">Correo
                  <input type="email" required autoComplete="username" value={customerInfo.email??''} onChange={event=>setCustomerInfo(prev=>({...prev,email:event.target.value}))} className={fieldStyle}/>
                </label>
                <label className="block text-sm">Contraseña
                  <input type="password" required autoComplete="current-password" value={customerInfo.password??''} onChange={event=>setCustomerInfo(prev=>({...prev,password:event.target.value}))} className={fieldStyle}/>
                </label>
                <button type="submit" className="min-h-12 w-full rounded-xl bg-amber-300 px-4 py-3 text-sm font-bold text-slate-950">Entrar</button>
              </form>
              {emailSignupEnabled&&<button type="button" onClick={()=>setView("client-register")} className="mt-2 min-h-11 text-sm text-slate-200 underline underline-offset-4">Registrarme con correo</button>}
            </details>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
            <button type="button" onClick={()=>setView("client-auth")} className="min-h-11 text-slate-300 hover:text-white">Volver</button>
          </div>
          <p className="mt-2 text-xs text-slate-300"><a href="/condiciones.html" className="underline underline-offset-2">Condiciones</a> <span aria-hidden="true">·</span> <a href="/privacidad.html" className="underline underline-offset-2">Privacidad</a></p>
        </div>
      </section>
    </main>
  );
}
if (view === "admin" && adminAccess) return <Suspense fallback={lazyFallback}><AdminShops api={api} profile={identity.profile} onSecurity={()=>setAdminSecurityOpen(true)} onLogout={handleLogout} onBack={()=>setView('client')} onChanged={cargarBarberiasActivas}/></Suspense>;
  const catalogControls=<><CatalogFilters showSearch={false} query={query} district={district} order={order} hasLocation={!!location} onQuery={setQuery} onDistrict={setDistrict} onOrder={setOrder} onUseLocation={enableLocation} onClearFilters={clearCatalogFilters} districtPrompt={catalogCategory==='barberia'?'Escoge tu distrito':undefined} businessLabel={catalogCategory==='belleza'?'salón':'barbería'} businessPlural={catalogCategory==='belleza'?'peluquerías y salones':'barberías'} />
    {locationError&&<p role="alert" className="mt-2 text-sm text-amber-300">{locationError}</p>}</>;
  return (
    <Suspense fallback={lazyFallback}>
    <div data-meryo-theme={catalogCategory==='belleza'?'beauty':'barberia'} data-meryo-mode={themeMode} data-meryo-appearance={themeAppearance} className="meryo-catalog-page min-h-screen bg-neutral-950 pb-24 text-white md:pb-0">
      <MeryoHeader
        variant={themeMode==='light'?'light':'dark'}
        themeMode={themeMode} onToggleTheme={()=>toggleThemeMode(catalogCategory)}
        signedIn={Boolean(identity.profile)} loading={identity.loading}
        onHome={()=>setView('landing')} onProfessional={openProfessional}
        onAccount={()=>setView('account')} onNotifications={()=>setView('notifications')}
      />

      <main>
        {supabase.authUnavailable&&<p role="status" className="mx-auto max-w-7xl px-6 pt-5 text-amber-300">Puedes consultar perfiles, servicios y calendario. Registro, acceso y operaciones privadas requieren Supabase Auth de pruebas; no hay sesiones ficticias.</p>}
        {identity.error&&<p role="alert" className="px-6 text-red-300">{identity.error}</p>}
        {accessMessage&&<p role="status" className="px-6 text-amber-300">{accessMessage}</p>}
        {profileUnavailable&&<div role="alert" className="mx-auto my-5 max-w-4xl rounded-2xl border border-white/15 bg-neutral-900 p-5"><h1 className="text-xl font-bold">Este negocio ya no está disponible</h1><p className="mt-2 text-neutral-300">No mostramos perfiles que ya no están publicados.</p><button onClick={closeProfileModal} className="mt-4 rounded-xl border border-amber-400/50 px-4 py-2 text-amber-200">Volver al catálogo</button></div>}
        <section id="catalogo" className="meryo-catalog-section mx-auto max-w-7xl px-4 pt-4 pb-10 md:px-6 md:pt-8 md:pb-16">
          <div className={catalogCategory==='barberia'?'meryo-barber-sticky':undefined}>
          <div className="meryo-catalog-topline">
            <div className="min-w-0"><h1 className="meryo-catalog-heading">{catalogCategory==='belleza'?'Encuentra tu salón':'Encuentra tu barbería'}</h1>{district&&<p className="mt-1 text-sm text-neutral-400">Distrito: {district}</p>}</div>
            <div className="meryo-catalog-top-actions"><p className="meryo-catalog-count" aria-live="polite">{catalogLoading||!catalogMatchesCategory?'Cargando…':catalogError?'Catálogo no disponible':catalogCountLabel(catalogCategory,ranking.length)}</p></div>
          </div>
          {catalogControls}
          <div className="meryo-catalog-fox-stage">
          <div className="meryo-catalog-shortcuts" aria-label="Accesos rápidos">
            <TurnFinder key={`turn-finder-${catalogCategory}`} category={catalogCategory} shops={catalogMatchesCategory&&!catalogLoading&&!catalogError?catalogRows:[]} disabled={!catalogMatchesCategory||catalogLoading||Boolean(catalogError)||catalogRows.length===0} slots={api.slots} themeMode={themeMode} themeAppearance={themeAppearance} onReserve={turn=>openBookingModal(turn.shop,turn,{startStep:3})}/>
            <button type="button" onClick={()=>{setSelectedInspiration(null);setInspirationIssue('');setView('inspiration');}}><BarberShortcutIcon kind="inspiration"/><span>Inspiración</span></button>
            <button type="button" className="meryo-catalog-promotion-shortcut" onClick={catalogCategory==='belleza'?openBeautyPromotions:()=>setView('promotions')}><BarberShortcutIcon kind="promotions"/><span>Promociones</span></button>
          </div>
          <div className="meryo-catalog-map-control"><button type="button" onClick={()=>setShowMap(value=>!value)} aria-expanded={showMap}><span>{showMap?'Ocultar mapa':catalogCategory==='barberia'?'Ver en el mapa':'Ver mapa'}</span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15m6-12v15"/></svg></button></div>
          {catalogCategory==='barberia'&&!showMap&&!showProfileModal&&!showBookingModal&&<Suspense fallback={null}><CatalogFox /></Suspense>}
          </div>
          </div>
          {showMap&&<div className="meryo-catalog-map-panel"><Suspense fallback={<p role="status">Cargando mapa…</p>}><CatalogMap markers={markers} location={location} onSelect={id=>{const shop=catalogRows.find(item=>item.id===id);if(shop)openProfileModal(shop);}}/></Suspense>{markers.length===0&&<p className="mt-3 text-sm text-neutral-400">No hay ubicaciones verificables para estos resultados.</p>}</div>}
          {catalogMatchesCategory&&!catalogLoading&&!catalogError&&catalogRows.length>0&&ranking.length===0&&<p role="status" className="meryo-catalog-no-match">No encontramos {catalogCategory==='belleza'?'peluquerías ni salones':'barberías'} con esos filtros.</p>}
          <CatalogStatus loading={catalogLoading||!catalogMatchesCategory} error={catalogMatchesCategory?catalogError:''} empty={catalogRows.length===0} businessLabel={catalogCategory==='belleza'?'peluquerías y salones':'barberías'} onRetry={cargarBarberiasActivas}/>
          {!catalogLoading&&!catalogError&&catalogMatchesCategory&&<BarberCatalogHighlights key={`${catalogCategory}-${identity.profile?.id??'guest'}`} api={api} shops={ranking} identity={identity.profile} category={catalogCategory} onLogin={()=>openLogin('client')} onView={openProfileModal} onReserve={shop=>openBookingModal(shop,null,{startStep:1})}/>}
        </section>
      </main>

      {showProfileModal&&<Suspense fallback={lazyFallback}><ProfileModalView
        selectedShop={showProfileModal ? selectedShop : null}
        catalogCategory={catalogCategory}
        themeMode={themeMode}
        themeAppearance={themeAppearance}
        contentLoading={profileAssetsLoading}
        contentError={profileAssetsError}
        onClose={closeProfileModal}
        onStore={openStoreModal}
        onReserve={service => {
          setShowProfileModal(false);
          openBookingModal(selectedShop,null,{service});
        }}
        onInspiration={()=>{const url=new URL(window.location.href);url.pathname='/';url.search='';url.searchParams.set('catalogo',catalogCategory);url.hash='inspiration';window.history.replaceState(window.history.state,'',url.href);setLocationPath('/');setShowProfileModal(false);setSelectedInspiration(null);setInspirationIssue('');setView('inspiration');}}
      /></Suspense>}

      {showStoreModal&&storeShop&&<Suspense fallback={null}><StoreModal key={`${storeShop.id}-${Boolean(restoredPickupCart)}`} api={api} shop={storeShop} profile={identity.profile} category={storeCategory} themeMode={themeModes[storeCategory]||'light'} themeAppearance={themePalettes[storeCategory]||DEFAULT_THEME_APPEARANCE[storeCategory]?.[themeModes[storeCategory]||'light']} initialCart={restoredPickupCart} onLogin={destination=>openLogin(destination)} onClose={()=>{setShowStoreModal(false);setRestoredPickupCart(null);}} onOpenOrders={orderId=>{setShowStoreModal(false);const url=new URL(window.location.href);url.searchParams.set('pedido',orderId);window.history.replaceState(null,'',url.pathname+url.search+'#my-orders');setView('my-orders');}}/></Suspense>}

      {renderBookingModal()}

      <MobileBottomNav active="explore" onNavigate={navigateMobile}/>

      <footer className="border-t border-white/10 py-6 text-center text-neutral-500">© 2026 MERYO <a href="/privacidad.html" className="ml-4 hover:text-amber-400">Privacidad</a><a href="/condiciones.html" className="ml-4 hover:text-amber-400">Condiciones</a></footer>
    </div>
    </Suspense>
  );
}
