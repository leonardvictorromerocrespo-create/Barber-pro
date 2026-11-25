import {useEffect,useRef,useState} from 'react';
import PublicShopLocation from './PublicShopLocation';
import ProfessionalAvatar from './ProfessionalAvatar';
import {isTeamPhotoTitle,PROFILE_PHOTO_TITLE} from '../lib/shop-content';
import {publicShopUrl} from '../lib/public-shop-url';

function StoreActionLabel() {
  return <><span>Tienda</span><svg className="meryo-profile-store-icon" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M4 10v10h16V10M3 7l2-4h14l2 4v2a3 3 0 0 1-4.5 2.6 3 3 0 0 1-4.5 0 3 3 0 0 1-4.5 0A3 3 0 0 1 3 9V7Z"/><path d="M3 7h18M9 20v-5h6v5"/></svg></>;
}

function BackArrowIcon(){
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/><path d="M9 12h11"/></svg>;
}

export default function ProfileModal({selectedShop,onClose,onReserve,onStore,onInspiration,onRefreshServices,catalogCategory='barberia',themeMode='dark',themeAppearance,initialTab='servicios',contentLoading=false,contentError='',onRetryContent}) {
  const [shareFeedback,setShareFeedback]=useState('');
  const [activeTab,setActiveTab]=useState(initialTab);
  const [aboutExpanded,setAboutExpanded]=useState(false);
  const [resourceError,setResourceError]=useState('');
  useEffect(()=>{setResourceError('');},[selectedShop?.id,selectedShop?.assets]);
  const closeRef=useRef(null);
  const scrollContainerRef=useRef(null);
  const tabsRef=useRef(null);
  const onCloseRef=useRef(onClose);
  onCloseRef.current=onClose;
  const selectedShopId=selectedShop?String(selectedShop.id):null;
  useEffect(()=>{
    if(!selectedShop)return undefined;
    const previousFocus=document.activeElement;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    closeRef.current?.focus();
    const onKeyDown=event=>{
      if(event.key==='Escape'){onCloseRef.current();return;}
      if(event.key!=='Tab')return;
      const controls=[...document.querySelectorAll('.meryo-profile-modal button:not(:disabled),.meryo-profile-modal a[href],.meryo-profile-modal input:not(:disabled),.meryo-profile-modal select:not(:disabled),.meryo-profile-modal textarea:not(:disabled),.meryo-profile-modal [tabindex]:not([tabindex="-1"])')].filter(element=>element.getClientRects().length);
      if(!controls.length)return;
      const first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    window.addEventListener('keydown',onKeyDown);
    return()=>{window.removeEventListener('keydown',onKeyDown);document.body.style.overflow=previousOverflow;if(previousFocus?.isConnected)previousFocus.focus();};
  },[selectedShopId]);
  useEffect(()=>{setActiveTab(initialTab);setAboutExpanded(false);setShareFeedback('');},[selectedShopId,initialTab]);
  if(!selectedShop)return null;

  const photos=selectedShop.assets?.filter(asset=>asset.kind==='foto'&&asset.url&&asset.title!==PROFILE_PHOTO_TITLE)??[];
  const workPhotos=photos.filter(asset=>!isTeamPhotoTitle(asset.title));
  const videos=selectedShop.assets?.filter(asset=>asset.kind==='video'&&asset.url)??[];
  const services=selectedShop.services??[];
  const team=selectedShop.equipo??[];
  const reviews=selectedShop.resenas??[];
  const hasBookableService=services.some(service=>service.bookable);
  const isMixed=selectedShop.businessTypes?.includes('barberia')&&selectedShop.businessTypes?.includes('belleza');
  const profileLabel=isMixed?'barbería y salón':catalogCategory==='belleza'?'salón de belleza':'barbería';
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
  const tabs=[['servicios','Servicios'],['equipo','Equipo'],['trabajos','Trabajos'],['informacion','Información']];
  const firstBookable=services.find(service=>service.bookable);
  const scrollTabsToTop=()=>{
    const container=scrollContainerRef.current,tabsElement=tabsRef.current;
    if(!container||!tabsElement)return;
    const top=container.scrollTop+tabsElement.getBoundingClientRect().top-container.getBoundingClientRect().top;
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
    container.scrollTo({top,behavior:reduced?'auto':'smooth'});
  };
  const selectTab=id=>{
    setActiveTab(id);
    if(id==='servicios')onRefreshServices?.();
    window.requestAnimationFrame(scrollTabsToTop);
  };

  const mediaError=(contentError||resourceError)&&<div role="alert" className="meryo-profile-empty"><p>{contentError||resourceError}</p>{onRetryContent&&<button type="button" className="min-h-11 px-3 py-2 underline" onClick={onRetryContent}>Reintentar contenido</button>}</div>;
  let tabContent;
  if(activeTab==='servicios')tabContent=<section role="tabpanel" id="meryo-profile-panel" aria-labelledby="meryo-profile-tab-servicios" className="meryo-profile-tab-panel">
    {services.length?<div className="meryo-profile-service-list">{services.map(service=><article key={service.id} className="meryo-profile-service-row">
      <div className="min-w-0"><h4>{service.name}</h4><p>{service.duration||'Duración por definir'}{service.requiresEvaluation?' · Requiere evaluación':''}</p></div>
      <div className="meryo-profile-service-price">{service.bookable?`S/ ${Number(service.price).toFixed(2)}`:'Precio por confirmar'}</div>
      <button type="button" disabled={!service.bookable} onClick={()=>onReserve(service)} className={`meryo-profile-row-action${catalogCategory==='barberia'?' meryo-profile-row-action--premium':''} min-h-11 rounded-lg px-3 py-2 text-sm font-semibold`}><span className="meryo-profile-choice-label">{service.bookable?'Elegir':'No reservable'}</span><span className="meryo-profile-choice-icon" role="img" aria-label={service.bookable?`Elegir ${service.name}`:`${service.name}: no reservable`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span></button>
    </article>)}</div>:<p className="meryo-profile-empty">El negocio aún no publicó servicios.</p>}
  </section>;
  else if(activeTab==='equipo')tabContent=<section role="tabpanel" id="meryo-profile-panel" aria-labelledby="meryo-profile-tab-equipo" className="meryo-profile-tab-panel">
    {team.length?<div className="meryo-profile-team-list">{team.map(member=>{
      const rating=Number(member.rating),reviewCount=Number(member.reviews);
      const hasRating=Number.isFinite(rating)&&rating>=1&&rating<=5&&Number.isInteger(reviewCount)&&reviewCount>0;
      return <article key={member.id||member.nombre} className="meryo-profile-team-card"><ProfessionalAvatar shop={selectedShop} member={member} className="meryo-profile-member-photo"/><div className="meryo-profile-team-identity">{member.propietario&&<span className="meryo-profile-owner-label">Propietario</span>}<h4>{member.nombre}</h4>{themeMode==='light'&&<p className="meryo-profile-member-role">{member.especialidad||member.rol||(member.propietario?'Propietario':catalogCategory==='belleza'?'Profesional de belleza':'Barbero profesional')}</p>}{hasRating&&<p className="meryo-profile-member-rating" aria-label={`Calificación ${rating.toFixed(1)} de 5, ${reviewCount} reseñas`}>★ {rating.toFixed(1)}</p>}</div></article>;
    })}</div>:<p className="meryo-profile-empty">El negocio aún no publicó integrantes del equipo.</p>}
  </section>;
  else if(activeTab==='trabajos')tabContent=<section role="tabpanel" id="meryo-profile-panel" aria-labelledby="meryo-profile-tab-trabajos" className="meryo-profile-tab-panel">
    {onInspiration&&<div className="meryo-profile-work-heading"><button type="button" onClick={onInspiration} className="meryo-profile-secondary-action min-h-11 rounded-lg px-3 py-2 text-sm font-semibold">Ver Inspiración</button></div>}
    {contentLoading?<p role="status" className="meryo-profile-empty">Cargando fotos del portafolio…</p>:mediaError?mediaError:workPhotos.length?<div className="meryo-profile-work-grid">{workPhotos.map(asset=><figure key={asset.id} className="min-w-0"><img src={asset.url} alt={asset.title||`Trabajo publicado por el ${profileLabel}`} loading="lazy" onError={()=>setResourceError('No se pudo cargar una fotografía del trabajo.')}/>{asset.title&&<figcaption>{asset.title}</figcaption>}</figure>)}</div>:<p className="meryo-profile-empty">El negocio aún no publicó trabajos.</p>}
  </section>;
  else tabContent=<section role="tabpanel" id="meryo-profile-panel" aria-labelledby="meryo-profile-tab-informacion" className="meryo-profile-tab-panel">
    {selectedShop.about&&<div className="meryo-profile-info-block"><h4>Acerca del negocio</h4><p>{selectedShop.about}</p></div>}
    <PublicShopLocation key={selectedShop.id} shop={selectedShop} mapHeight="h-32 sm:h-48" className="meryo-profile-location"/>
    {!selectedShop.direccion&&!selectedShop.lat&&!selectedShop.lng&&!selectedShop.district&&<p className="meryo-profile-empty">El negocio aún no publicó su ubicación.</p>}
    {contentLoading?<p role="status" className="meryo-profile-empty">Cargando contenido del perfil…</p>:mediaError?mediaError:videos.length>0?<div className="meryo-profile-info-block"><h4>Video de presentación</h4>{videos.map(asset=><video key={asset.id} src={asset.url} controls preload="metadata" onError={()=>setResourceError('No se pudo cargar el video de presentación.')} aria-label="Video de presentación" className="mt-3 max-h-[28rem] w-full rounded-lg"/>)}</div>:<p className="meryo-profile-empty">El negocio aún no publicó un video de presentación.</p>}
    {(selectedShop.reviews>0||reviews.length>0)&&<div className="meryo-profile-info-block"><h4>Reseñas</h4>{selectedShop.reviews>0&&Number.isFinite(Number(selectedShop.rating))&&<p className="mt-2">★ {Number(selectedShop.rating).toFixed(1)} basado en {selectedShop.reviews} reseñas</p>}{reviews.map(review=><article key={review.id} className="meryo-profile-review"><p>{review.autor} · {review.calificacion}/5</p><p>{review.comentario}</p></article>)}</div>}
  </section>;

  return <div className="meryo-profile-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-0 sm:p-4" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <div ref={scrollContainerRef} role="dialog" aria-modal="true" aria-labelledby="meryo-profile-title" tabIndex={-1} data-meryo-theme={catalogCategory==='belleza'?'beauty':'barberia'} data-meryo-mode={themeMode} data-meryo-appearance={themeAppearance} className="meryo-profile-modal min-w-0 w-full overflow-auto">
      <header className="meryo-profile-header">
        {cover?<img src={cover} alt={`Portada de ${selectedShop.name}`} className="meryo-profile-cover"/>:<div className="meryo-profile-cover meryo-profile-cover--empty" role="img" aria-label="Sin portada publicada"/>}
        <div className="meryo-profile-cover-controls"><button ref={closeRef} type="button" onClick={onClose} aria-label={catalogCategory==='barberia'?'Volver al catálogo':undefined} className={`meryo-profile-close min-h-11 rounded-lg px-3 py-2 text-sm font-medium${catalogCategory==='barberia'?' meryo-profile-close--premium':''}`}>{catalogCategory==='barberia'?<><BackArrowIcon/><span className="sr-only">Volver</span></>:'Volver'}</button>{catalogCategory==='belleza'&&<button type="button" onClick={shareProfile} className="meryo-profile-close min-h-11 rounded-lg px-3 py-2 text-sm font-medium">Compartir perfil</button>}</div>
        <div className="meryo-profile-heading"><div className="meryo-profile-avatar">{selectedShop.profileImage?<img src={selectedShop.profileImage} alt={`Foto de ${selectedShop.name}`} className="h-full w-full object-cover"/>:initials}</div><div className="min-w-0 flex-1"><h2 id="meryo-profile-title">{selectedShop.name}</h2>{catalogCategory==='barberia'?<p className="meryo-profile-meta meryo-profile-meta--barberia"><span>{profileLabel}</span>{selectedShop.district&&<><span aria-hidden="true">·</span><span className="meryo-profile-district"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z" fill="#000000"/><circle cx="12" cy="9" r="2.4" fill="#ffffff"/></svg>{selectedShop.district}</span></>}</p>:<p className="meryo-profile-meta">{profileLabel}{selectedShop.district?` · ${selectedShop.district}`:''}</p>}{selectedShop.about&&<div><p className={aboutExpanded?'meryo-profile-description':'meryo-profile-description is-clamped'}>{selectedShop.about}</p>{selectedShop.about.length>120&&<button type="button" className="meryo-profile-read-more" aria-expanded={aboutExpanded} onClick={()=>setAboutExpanded(value=>!value)}>{aboutExpanded?'Leer menos':'Leer más'}</button>}</div>}</div></div>
      </header>
      <div className="meryo-profile-body">
       <div className="meryo-profile-quick-actions">
        {onStore&&<button type="button" onClick={()=>onStore(selectedShop)} className={`meryo-profile-secondary-action meryo-profile-store-action${catalogCategory==='barberia'?' meryo-profile-premium-action':''} min-h-11 rounded-lg px-3 py-2 text-sm font-medium`}><StoreActionLabel /></button>}
        {catalogCategory==='barberia'&&<button type="button" onClick={shareProfile} className="meryo-profile-secondary-action meryo-profile-premium-action meryo-profile-share-action min-h-11 rounded-lg px-3 py-2 text-sm font-medium">Compartir perfil</button>}
       </div>
       {shareFeedback&&<p aria-live="polite" className="meryo-profile-feedback">{shareFeedback}{shareFeedback.startsWith('Copia')&&<> <a className="break-all underline" href={profileUrl}>{profileUrl}</a></>}</p>}
       <div className="meryo-profile-layout">
        <main className="min-w-0"><div ref={tabsRef} role="tablist" aria-label={`Secciones del perfil de ${selectedShop.name}`} className="meryo-profile-tabs">{tabs.map(([id,label])=><button key={id} type="button" role="tab" id={`meryo-profile-tab-${id}`} aria-selected={activeTab===id} aria-controls="meryo-profile-panel" tabIndex={activeTab===id?0:-1} onClick={()=>selectTab(id)} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const current=tabs.findIndex(([tabId])=>tabId===activeTab);const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;selectTab(tabs[next][0]);document.getElementById(`meryo-profile-tab-${tabs[next][0]}`)?.focus();}}>{label}</button>)}</div>{tabContent}</main>
        <aside className="meryo-profile-sidebar"><p className="meryo-profile-sidebar-title">{selectedShop.name}</p><p>{services.filter(service=>service.bookable).length} servicios reservables</p>{services.some(service=>service.bookable)&&<p>Desde S/ {Math.min(...services.filter(service=>service.bookable).map(service=>Number(service.price))).toFixed(2)}</p>}{onStore&&<button type="button" onClick={()=>onStore(selectedShop)} className={`meryo-profile-secondary-action meryo-profile-store-action${catalogCategory==='barberia'?' meryo-profile-premium-action':''} min-h-11 w-full rounded-lg px-3 py-2 text-sm font-medium`}><StoreActionLabel /></button>}<button type="button" disabled={!hasBookableService} onClick={()=>onReserve(firstBookable)} className="meryo-profile-book-button min-h-12 w-full rounded-lg px-4 py-3 font-semibold">Reservar cita</button></aside>
       </div>
       <div className="meryo-profile-mobile-book"><button type="button" disabled={!hasBookableService} onClick={()=>onReserve(firstBookable)} className="meryo-profile-book-button min-h-12 w-full rounded-lg px-4 py-3 font-semibold">Reservar cita</button></div>
      </div>
    </div>
  </div>;
}
