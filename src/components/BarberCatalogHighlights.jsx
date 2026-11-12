import {useEffect,useRef,useState} from 'react';
import CatalogShopGrid from './CatalogShopGrid';
import './BarberCatalogHighlights.css';

function Featured({shops,onView,onReserve}) {
  const rail=useRef(null);
  const hinted=useRef(false);
  const [edges,setEdges]=useState({previous:false,next:false});
  useEffect(()=>{
    const el=rail.current;
    const update=()=>setEdges({previous:el.scrollLeft>2,next:el.scrollLeft+el.clientWidth<el.scrollWidth-2});
    update();
    const observer=new ResizeObserver(update);
    observer.observe(el);
    el.addEventListener('scroll',update,{passive:true});
    if(!hinted.current && el.scrollWidth>el.clientWidth+2 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      hinted.current=true;
      el.firstElementChild.animate([{transform:'translateX(0)'},{transform:'translateX(-24px)'},{transform:'translateX(0)'}],{duration:740,delay:400,easing:'ease-in-out'});
    }
    return()=>{observer.disconnect();el.removeEventListener('scroll',update);};
  },[shops]);
  const move=direction=>{
    const el=rail.current,card=el.querySelector('article');
    if(card)el.scrollBy({left:direction*(card.offsetWidth+12),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  };
  return <section className="meryo-discovery-shelf" aria-labelledby="featured-barbers-title">
    <div className="meryo-discovery-heading">
      <div><h2 id="featured-barbers-title">Destacados</h2><p>Espacios patrocinados</p></div>
      {(edges.previous||edges.next)&&<div className="meryo-rail-controls">
        <button type="button" disabled={!edges.previous} onClick={()=>move(-1)} aria-label="Destacados anteriores">‹</button>
        <button type="button" disabled={!edges.next} onClick={()=>move(1)} aria-label="Más barberías destacadas">›</button>
      </div>}
    </div>
    {(edges.previous||edges.next)&&<p className="meryo-rail-hint">Desliza hacia la izquierda para ver más barberías destacadas.</p>}
    <div className="meryo-featured-rail" ref={rail} tabIndex={shops.length>1?0:undefined} aria-label="Carrusel de barberías destacadas">
      <CatalogShopGrid shops={shops} onView={onView} onReserve={onReserve}/>
    </div>
  </section>;
}

export default function BarberCatalogHighlights({api,shops,identity,onLogin,onView,onReserve}) {
  const [data,setData]=useState(null);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const mutation=useRef(false);
  useEffect(()=>{
    let active=true;
    api.barberHighlights().then(rows=>{if(active)setData(rows);}).catch(()=>{if(active)setData(null);});
    return()=>{active=false;};
  },[api,identity?.id]);

  const stats=new Map(data?.map(row=>[String(row.shop_id),row]));
  const featured=shops.filter(shop=>stats.get(String(shop.id))?.featured);
  const liked=shops.filter(shop=>Number(stats.get(String(shop.id))?.likes)>0)
    .sort((a,b)=>Number(stats.get(String(b.id)).likes)-Number(stats.get(String(a.id)).likes)||a.name.localeCompare(b.name,'es')).slice(0,10);
  const vote=async shop=>{
    if(!identity){onLogin();return;}
    if(identity.rol!=='cliente'||mutation.current)return;
    mutation.current=true;setBusy(true);setMessage('');
    try{
      await api.setBarberLike(shop.id,!stats.get(String(shop.id))?.liked);
      setData(await api.barberHighlights());
    }catch{setMessage('No pudimos actualizar tu Me gusta. Inténtalo de nuevo.');}
    finally{mutation.current=false;setBusy(false);}
  };
  const renderLike=data!==null&&(!identity||identity.rol==='cliente')?shop=>{
    const info=stats.get(String(shop.id));
    return <button type="button" className="meryo-catalog-like" disabled={busy} aria-pressed={!!info?.liked} aria-label={`Me gusta: ${shop.name}`} onClick={()=>void vote(shop)}><span aria-hidden="true">{info?.liked?'♥':'♡'}</span> {Number(info?.likes||0)}</button>;
  }:undefined;

  return <>
    {featured.length>0&&<Featured shops={featured} onView={onView} onReserve={onReserve}/>}
    {liked.length>0&&<section className="meryo-discovery-shelf" aria-labelledby="liked-barbers-title">
      <div className="meryo-discovery-heading"><div><h2 id="liked-barbers-title">Más gustados</h2><p>Ordenados por los Me gusta de clientes.</p></div></div>
      <CatalogShopGrid shops={liked} onView={onView} onReserve={onReserve} renderLike={renderLike}/>
    </section>}
    {shops.length>0&&(featured.length>0||liked.length>0)&&<div className="meryo-discovery-heading"><h2>Todas las barberías</h2></div>}
    {message&&<p role="status">{message}</p>}
    <CatalogShopGrid shops={shops} onView={onView} onReserve={onReserve} renderLike={renderLike}/>
  </>;
}
