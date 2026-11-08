import {useEffect,useRef,useState} from 'react';
import PublicShopLocation from './PublicShopLocation';
import {PROFILE_PHOTO_TITLE} from '../lib/shop-content';
import {publicShopUrl} from '../lib/public-shop-url';

function SectionTitle({children}) { return <h3 className="meryo-profile-section-title">{children}</h3>; }

export default function ProfileModal({selectedShop,onClose,onReserve,onStore,onInspiration,catalogCategory='barberia',themeMode='dark',themeAppearance,initialTab='servicios'}) {
  const [shareFeedback,setShareFeedback]=useState('');
  const [activeTab,setActiveTab]=useState(initialTab);
  const [aboutExpanded,setAboutExpanded]=useState(false);
  const closeRef=useRef(null);
  const onCloseRef=useRef(onClose);
  onCloseRef.current=onClose;
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
  },[selectedShop?.id]);
  useEffect(()=>{setActiveTab(initialTab);setAboutExpanded(false);setShareFeedback('');},[selectedShop?.id,initialTab]);
  if(!selectedShop)return null;

  const photos=selectedShop.assets?.filter(asset=>asset.kind==='foto'&&asset.url&&asset.title!==PROFILE_PHOTO_TITLE)??[];
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

  let tabContent;
  if(activeTab==='servicios')tabContent=<section role="tabpanel" id="meryo-profile-panel" aria-labelledby="meryo-profile-tab-servicios" className="meryo-profile-tab-panel">
    <SectionTitle>Servicios</SectionTitle>
    {services.length?<div className="meryo-profile-service-list">{services.map(service=><article key={service.id} className="meryo-profile-service-row">
      <div className="min-w-0"><h4>{service.name}</h4><p>{service.duration||'Duración por definir'}{service.requiresEvaluation?' · Requiere evaluación':''}</p></div>
      <div className="meryo-profile-service-price">{service.bookable?`S/ ${Number(service.price).toFixed(2)}`:'Precio por confirmar'}</div>
      <button type="button" disabled={!service.bookable} onClick={()=>onReserve(service)} className="meryo-profile-row-action min-h-11 rounded-lg px-3 py-2 text-sm font-semibold">{service.bookable?'Elegir':'No reservable'}</button>
    </article>)}</div>:<p className="meryo-profile-empty">El negocio aún no publicó servicios.</p>}
  </section>;
  else if(activeTab==='equipo')tabContent=<section role="tabpanel" id="meryo-profile-panel" aria-labelledby="meryo-profile-tab-equipo" className="meryo-profile-tab-panel">
    <SectionTitle>Equipo</SectionTitle>
    {team.length?<div className="meryo-profile-team-list">{team.map(member=>{
      const memberServices=services.filter(service=>(member.servicios??[]).some(id=>String(id)===String(service.id)));
      const memberInitials=String(member.nombre||'?').trim().split(/\s+/).slice(0,2).map(part=>Array.from(part)[0]||'').join('').toLocaleUpperCase('es');
      return <article key={member.id||member.nombre} className="meryo-profile-team-card"><div className="meryo-profile-member-photo">{member.foto_url?<img src={member.foto_url} alt={`Foto de ${member.nombre}`} loading="lazy"/>:memberInitials}</div><div className="min-w-0"><h4>{member.nombre}{member.propietario?' · propietario':''}</h4><p>{memberServices.length?`Servicios: ${memberServices.map(service=>service.name).join(', ')}`:'Servicios por consultar con el negocio'}</p></div></article>;
    })}</div>:<p className="meryo-profile-empty">El negocio aún no publicó integrantes del equipo.</p>}
  </section>;
  else if(activeTab==='trabajos')tabContent=<section role="tabpanel" id="meryo-profile-panel" aria-labelledby="meryo-profile-tab-trabajos" className="meryo-profile-tab-panel">
    <div className="meryo-profile-work-heading"><SectionTitle>Trabajos</SectionTitle>{onInspiration&&<button type="button" onClick={onInspiration} className="meryo-profile-secondary-action min-h-11 rounded-lg px-3 py-2 text-sm font-semibold">Ver Inspiración</button>}</div>
    {photos.length?<div className="meryo-profile-work-grid">{photos.map(asset=><figure key={asset.id} className="min-w-0"><img src={asset.url} alt={asset.title||`Trabajo publicado por el ${profileLabel}`} loading="lazy"/>{asset.title&&<figcaption>{asset.title}</figcaption>}</figure>)}</div>:<p className="meryo-profile-empty">El negocio aún no publicó trabajos.</p>}
  </section>;
  else tabContent=<section role="tabpanel" id="meryo-profile-panel" aria-labelledby="meryo-profile-tab-informacion" className="meryo-profile-tab-panel">
    <SectionTitle>Información</SectionTitle>
    {selectedShop.about&&<div className="meryo-profile-info-block"><h4>Acerca del negocio</h4><p>{selectedShop.about}</p></div>}
    <PublicShopLocation key={selectedShop.id} shop={selectedShop} mapHeight="h-32 sm:h-48" className="meryo-profile-location"/>
    {!selectedShop.direccion&&!selectedShop.lat&&!selectedShop.lng&&!selectedShop.district&&<p className="meryo-profile-empty">El negocio aún no publicó su ubicación.</p>}
    {videos.length>0?<div className="meryo-profile-info-block"><h4>Video de presentación</h4>{videos.map(asset=><video key={asset.id} src={asset.url} controls preload="metadata" aria-label="Video de presentación" className="mt-3 max-h-[28rem] w-full rounded-lg"/>)}</div>:selectedShop.contentError&&<p role="alert" className="meryo-profile-empty">{selectedShop.contentError}</p>}
    {(selectedShop.reviews>0||reviews.length>0)&&<div className="meryo-profile-info-block"><h4>Reseñas</h4>{selectedShop.reviews>0&&Number.isFinite(Number(selectedShop.rating))&&<p className="mt-2">★ {Number(selectedShop.rating).toFixed(1)} basado en {selectedShop.reviews} reseñas</p>}{reviews.map(review=><article key={review.id} className="meryo-profile-review"><p>{review.autor} · {review.calificacion}/5</p><p>{review.comentario}</p></article>)}</div>}
  </section>;

  return <div className="meryo-profile-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-0 sm:p-4" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <div role="dialog" aria-modal="true" aria-labelledby="meryo-profile-title" tabIndex={-1} data-meryo-theme={catalogCategory==='belleza'?'beauty':'barberia'} data-meryo-mode={themeMode} data-meryo-appearance={themeAppearance} className="meryo-profile-modal min-w-0 w-full overflow-auto">
      <header className="meryo-profile-header">
        {cover?<img src={cover} alt={`Portada de ${selectedShop.name}`} className="meryo-profile-cover"/>:<div className="meryo-profile-cover meryo-profile-cover--empty" role="img" aria-label="Sin portada publicada"/>}
        <div className="meryo-profile-cover-controls"><button ref={closeRef} type="button" onClick={onClose} className="meryo-profile-close min-h-11 rounded-lg px-3 py-2 text-sm font-medium">Volver</button><button type="button" onClick={shareProfile} className="meryo-profile-close min-h-11 rounded-lg px-3 py-2 text-sm font-medium">Compartir perfil</button></div>
        <div className="meryo-profile-heading"><div className="meryo-profile-avatar">{selectedShop.profileImage?<img src={selectedShop.profileImage} alt={`Foto de ${selectedShop.name}`} className="h-full w-full object-cover"/>:initials}</div><div className="min-w-0 flex-1"><h2 id="meryo-profile-title">{selectedShop.name}</h2><p className="meryo-profile-meta">{profileLabel}{selectedShop.district?` · ${selectedShop.district}`:''}</p>{selectedShop.about&&<div><p className={aboutExpanded?'meryo-profile-description':'meryo-profile-description is-clamped'}>{selectedShop.about}</p>{selectedShop.about.length>120&&<button type="button" className="meryo-profile-read-more" aria-expanded={aboutExpanded} onClick={()=>setAboutExpanded(value=>!value)}>{aboutExpanded?'Leer menos':'Leer más'}</button>}</div>}</div></div>
      </header>
      <div className="meryo-profile-body">
       <div className="meryo-profile-quick-actions">{onStore&&<button type="button" onClick={()=>onStore(selectedShop)} className="meryo-profile-secondary-action min-h-11 rounded-lg px-3 py-2 text-sm font-medium">Tienda</button>}</div>
       {shareFeedback&&<p aria-live="polite" className="meryo-profile-feedback">{shareFeedback}{shareFeedback.startsWith('Copia')&&<> <a className="break-all underline" href={profileUrl}>{profileUrl}</a></>}</p>}
       <div className="meryo-profile-layout">
        <main className="min-w-0"><div role="tablist" aria-label={`Secciones del perfil de ${selectedShop.name}`} className="meryo-profile-tabs">{tabs.map(([id,label])=><button key={id} type="button" role="tab" id={`meryo-profile-tab-${id}`} aria-selected={activeTab===id} aria-controls="meryo-profile-panel" tabIndex={activeTab===id?0:-1} onClick={()=>setActiveTab(id)} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const current=tabs.findIndex(([tabId])=>tabId===activeTab);const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;setActiveTab(tabs[next][0]);document.getElementById(`meryo-profile-tab-${tabs[next][0]}`)?.focus();}}>{label}</button>)}</div>{tabContent}</main>
        <aside className="meryo-profile-sidebar"><p className="meryo-profile-sidebar-title">{selectedShop.name}</p><p>{services.filter(service=>service.bookable).length} servicios reservables</p>{services.some(service=>service.bookable)&&<p>Desde S/ {Math.min(...services.filter(service=>service.bookable).map(service=>Number(service.price))).toFixed(2)}</p>}{onStore&&<button type="button" onClick={()=>onStore(selectedShop)} className="meryo-profile-secondary-action min-h-11 w-full rounded-lg px-3 py-2 text-sm font-medium">Tienda</button>}<button type="button" disabled={!hasBookableService} onClick={()=>onReserve(firstBookable)} className="meryo-profile-book-button min-h-12 w-full rounded-lg px-4 py-3 font-semibold">Reservar cita</button></aside>
       </div>
       <div className="meryo-profile-mobile-book"><button type="button" disabled={!hasBookableService} onClick={()=>onReserve(firstBookable)} className="meryo-profile-book-button min-h-12 w-full rounded-lg px-4 py-3 font-semibold">Reservar cita</button></div>
      </div>
    </div>
  </div>;
}
