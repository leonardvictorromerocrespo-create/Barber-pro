import {useCallback,useEffect,useRef,useState} from 'react';
import MeryoHeader from './MeryoHeader';
import './InspirationGallery.css';

const PAGE_SIZE=24;
const FILTERS={
 barberia:[['corte','Cortes'],['barba','Barba'],['coloracion','Coloración'],['peinados','Peinados'],['tratamientos_capilares','Tratamientos']],
 belleza:[['corte','Cortes'],['coloracion','Coloración'],['peinados','Peinados'],['tratamientos_capilares','Tratamientos capilares'],['manicure','Manicure'],['pedicure','Pedicure'],['depilacion','Depilación']],
};
const categoryLabel={barberia:'barbería',belleza:'salón'};

function WorkCard({item,onOpen}){
 return <button type="button" className="meryo-inspiration-card" onClick={()=>onOpen(item)} aria-label={`Ver trabajo ${item.title}, ${item.shop_name}${item.professional_name?`, ${item.professional_name}`:''}`}>
  <img src={item.url||undefined} alt={`${item.title} · ${item.shop_name}`} loading="lazy" decoding="async"/>
  <span className="meryo-inspiration-card__caption"><strong>{item.title}</strong><span>{item.shop_name}{item.professional_name?` · ${item.professional_name}`:''}</span></span>
 </button>;
}

export default function InspirationGallery({api,category='barberia',themeMode='dark',themeAppearance,onToggleTheme,onBack,onViewProfile,onBook,onNavigate,BottomNav,initialPublication=null,signedIn=false,loadingIdentity=false}){
 const key=`meryo.inspiration.${category}.v1`;
 const initial=()=>{try{return typeof window!=='undefined'?JSON.parse(window.sessionStorage.getItem(key)||'{}'):{};}catch{return {};}};
 const [workCategory,setWorkCategory]=useState(()=>initial().workCategory||'');
 const [rows,setRows]=useState([]),[offset,setOffset]=useState(0),[hasMore,setHasMore]=useState(false);
 const [loading,setLoading]=useState(true),[loadingMore,setLoadingMore]=useState(false),[error,setError]=useState('');
 const [selected,setSelected]=useState(initialPublication),[detailError,setDetailError]=useState('');
 const [actionBusy,setActionBusy]=useState(false),request=useRef(0);
 const [reloadRevision,setReloadRevision]=useState(0);
 useEffect(()=>{try{sessionStorage.setItem(key,JSON.stringify({workCategory}));}catch{return;}},[key,workCategory]);
 useEffect(()=>{
  const current=++request.current;let active=true;setLoading(true);setLoadingMore(false);setError('');setRows([]);setOffset(0);setHasMore(false);
  api.inspirations(category,{workCategory:workCategory||null,limit:PAGE_SIZE,offset:0}).then(items=>{
   if(!active||current!==request.current)return;setRows(items);setOffset(items.length);setHasMore(items.length===PAGE_SIZE);
  }).catch(e=>{if(active&&current===request.current)setError(e.message||'No pudimos cargar Inspiración.');}).finally(()=>{if(active&&current===request.current)setLoading(false);});
  return()=>{active=false;};
 },[api,category,workCategory,reloadRevision]);
 useEffect(()=>{
  if(!initialPublication?.id){setSelected(null);return;}
  setSelected(initialPublication);setDetailError('');
 },[initialPublication]);
 const loadMore=async()=>{
  if(loadingMore||!hasMore)return;const current=request.current;setLoadingMore(true);setError('');
  try{const items=await api.inspirations(category,{workCategory:workCategory||null,limit:PAGE_SIZE,offset});if(current!==request.current)return;setRows(old=>[...old,...items]);setOffset(value=>value+items.length);setHasMore(items.length===PAGE_SIZE);}
  catch(e){if(current===request.current)setError(e.message||'No pudimos cargar más trabajos.');}
  finally{if(current===request.current)setLoadingMore(false);}
 };
 const closeDetail=useCallback(()=>{setSelected(null);setDetailError('');},[]);
 useEffect(()=>{if(!selected)return;const onKey=e=>{if(e.key==='Escape')closeDetail();};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[selected,closeDetail]);
 const openDetail=item=>{setDetailError('');setSelected(item);};
 const checkProfile=async()=>{if(!selected)return;setActionBusy(true);setDetailError('');try{await onViewProfile(selected);}catch(e){setDetailError(e.message||'No se pudo abrir el perfil.');}finally{setActionBusy(false);}};
 const requestStyle=async()=>{if(!selected?.can_request)return;setActionBusy(true);setDetailError('');try{await onBook(selected);}catch(e){setDetailError(e.message||'No se pudo preparar la reserva. Revisa el perfil del negocio.');}finally{setActionBusy(false);}};
 const business=categoryLabel[category]||'negocio';
 return <div className="meryo-inspiration-page min-h-screen pb-24 text-white md:pb-0" data-meryo-theme={category==='belleza'?'beauty':'barberia'} data-meryo-mode={themeMode} data-meryo-appearance={themeAppearance}>
  <MeryoHeader variant={themeMode==='light'?'light':'dark'} themeMode={themeMode} onToggleTheme={onToggleTheme} signedIn={signedIn} loading={loadingIdentity} onHome={onBack} onProfessional={()=>onNavigate('account')} onAccount={()=>onNavigate('account')} onNotifications={()=>onNavigate('notifications')}/>
  <main className="mx-auto max-w-7xl px-4 pb-12 pt-7 sm:px-6 sm:pt-10">
   <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><button className="meryo-inspiration-back" type="button" onClick={onBack}>Volver al catálogo</button><p className="meryo-inspiration-kicker">{category==='belleza'?'PELUQUERÍAS Y BELLEZA':'BARBERÍAS'}</p><h1>Encuentra tu próximo estilo</h1><p className="meryo-inspiration-intro">Trabajos publicados por {category==='belleza'?'peluquerías y salones':'barberías'} de MERYO.</p></div></div>
   <div className="meryo-inspiration-filters" aria-label="Filtrar trabajos por categoría"><button type="button" aria-pressed={!workCategory} className={!workCategory?'is-active':''} onClick={()=>setWorkCategory('')}>Todos</button>{(FILTERS[category]||FILTERS.barberia).map(([id,label])=><button type="button" key={id} aria-pressed={workCategory===id} className={workCategory===id?'is-active':''} onClick={()=>setWorkCategory(id)}>{label}</button>)}</div>
   {loading&&<p role="status" className="meryo-inspiration-state">Cargando trabajos publicados…</p>}
   {!loading&&error&&!rows.length&&<div role="alert" className="meryo-inspiration-state"><p>{error}</p><button type="button" onClick={()=>setReloadRevision(value=>value+1)}>Reintentar</button></div>}
   {!loading&&!error&&!rows.length&&<p role="status" className="meryo-inspiration-state">Todavía no hay trabajos publicados en esta categoría.</p>}
   {!!rows.length&&<div className="meryo-inspiration-grid">{rows.map(item=><WorkCard key={item.id} item={item} onOpen={openDetail}/>)}</div>}
   {error&&rows.length>0&&<div role="alert" className="meryo-inspiration-state mt-4"><p>No se pudo cargar la siguiente página. {error}</p><button type="button" onClick={loadMore} disabled={loadingMore}>{loadingMore?'Cargando…':'Reintentar'}</button></div>}
   {!loading&&!error&&hasMore&&<div className="mt-7 flex justify-center"><button type="button" className="meryo-inspiration-more" onClick={loadMore} disabled={loadingMore}>{loadingMore?'Cargando…':'Ver más trabajos'}</button></div>}
  </main>
  {BottomNav&&<BottomNav active="explore" onNavigate={onNavigate}/>}
  {selected&&<div className="meryo-inspiration-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)closeDetail();}}>
   <section className="meryo-inspiration-detail" role="dialog" aria-modal="true" aria-labelledby="meryo-inspiration-title">
    <header><p>Inspiración · {business}</p><button type="button" onClick={closeDetail} aria-label="Cerrar trabajo">Cerrar</button></header>
    <div className="meryo-inspiration-detail__image"><img src={selected.url||undefined} alt={selected.title} decoding="async"/></div>
    <div className="meryo-inspiration-detail__body"><h2 id="meryo-inspiration-title">{selected.title}</h2>{selected.description&&<p>{selected.description}</p>}
     <dl><div><dt>Negocio</dt><dd>{selected.shop_name}</dd></div>{selected.professional_name&&<div><dt>Profesional</dt><dd>{selected.professional_name}</dd></div>}{selected.service_name&&<div><dt>Servicio asociado</dt><dd>{selected.service_name}</dd></div>}</dl>
     <p className="meryo-inspiration-disclaimer">La imagen es una referencia; el resultado puede variar según el cabello y la evaluación profesional.</p>
     {detailError&&<p role="alert" className="meryo-inspiration-error">{detailError}</p>}
     <div className="meryo-inspiration-actions"><button type="button" onClick={checkProfile} disabled={actionBusy}>Ver perfil</button>{selected.can_request===true&&<button type="button" className="is-primary" onClick={requestStyle} disabled={actionBusy}>{actionBusy?'Preparando…':'Quiero este estilo'}</button>}</div>
    </div>
   </section>
  </div>}
 </div>;
}
