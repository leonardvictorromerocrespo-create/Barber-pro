import {useEffect,useRef,useState} from 'react';
import CatalogShopGrid from './CatalogShopGrid';
import './BarberCatalogHighlights.css';

function Featured({shops,onView,onReserve,category='barberia',renderLike,title='DESTACADOS',description,titleId}) {
  const rail=useRef(null);
  const loopGroup=useRef(null);
  const hinted=useRef(false);
  const initialBeautyPositioned=useRef(false);
  const [edges,setEdges]=useState({previous:false,next:false});
  const [reducedMotion,setReducedMotion]=useState(()=>typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true);
  const [loopMeasurement,setLoopMeasurement]=useState(null);
  const [userPausedLoop,setUserPausedLoop]=useState(false);
  const [interactionPaused,setInteractionPaused]=useState(false);
  const [userStoppedLoop,setUserStoppedLoop]=useState(false);
  const pointerInside=useRef(false);
  const focusInside=useRef(false);
  const pointerStart=useRef(null);
  const interactionTimer=useRef(null);
  const beauty=category==='belleza';
  const sectionKind=title==='MÁS ME GUSTA'?'con más Me gusta':'destacadas';
  const autoLoop=['barberia','belleza'].includes(category)&&shops.length>1;
  const loopCycleWidth=loopMeasurement?.shops===shops?loopMeasurement.cycleWidth:0;
  const loopCloneCount=loopMeasurement?.shops===shops?loopMeasurement.cloneCount:1;
  const isPlaying=autoLoop&&!reducedMotion&&!userStoppedLoop&&!userPausedLoop;
  const loopReady=autoLoop&&loopCycleWidth>0&&!reducedMotion;
  useEffect(()=>{
    const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if(!media)return;
    const update=()=>setReducedMotion(media.matches);
    update();
    if(media.addEventListener){
      media.addEventListener('change',update);
      return()=>media.removeEventListener('change',update);
    }
    media.addListener?.(update);
    return()=>media.removeListener?.(update);
  },[]);
  useEffect(()=>{
    if(!autoLoop)return;
    const group=loopGroup.current;
    if(!group)return;
    const measure=()=>{
      const cycleWidth=group.getBoundingClientRect().width+12;
      const viewportWidth=rail.current?.clientWidth||0;
      const cloneCount=cycleWidth>0?Math.max(1,Math.ceil(viewportWidth/cycleWidth)):1;
      setLoopMeasurement(previous=>previous?.shops===shops&&previous.cycleWidth===cycleWidth&&previous.cloneCount===cloneCount?previous:{shops,cycleWidth,cloneCount});
    };
    measure();
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(measure):null;
    if(observer)observer.observe(group);
    if(observer&&rail.current)observer.observe(rail.current);
    else window.addEventListener('resize',measure);
    return()=>{observer?.disconnect();window.removeEventListener('resize',measure);};
  },[autoLoop,shops]);
  useEffect(()=>{
    const el=rail.current;
    if(!loopReady||!isPlaying||interactionPaused||userStoppedLoop||!el)return;
    let frame=0,lastFrame=0;
    const tick=now=>{
      if(lastFrame){
        const elapsed=Math.min(now-lastFrame,48);
        const nextOffset=el.scrollLeft+loopCycleWidth*elapsed/48000;
        el.scrollLeft=nextOffset>=loopCycleWidth?nextOffset%loopCycleWidth:nextOffset;
      }
      lastFrame=now;
      frame=window.requestAnimationFrame(tick);
    };
    frame=window.requestAnimationFrame(tick);
    return()=>window.cancelAnimationFrame(frame);
  },[loopReady,isPlaying,interactionPaused,userStoppedLoop,loopCycleWidth]);
  const suspendForInteraction=()=>{
    if(interactionTimer.current)window.clearTimeout(interactionTimer.current);
    setInteractionPaused(true);
  };
  const resumeAfterInteraction=()=>{
    if(userStoppedLoop||pointerInside.current||focusInside.current)return;
    if(interactionTimer.current)window.clearTimeout(interactionTimer.current);
    interactionTimer.current=window.setTimeout(()=>setInteractionPaused(false),1600);
  };
  const stopAfterManualMove=()=>{
    if(!autoLoop)return;
    if(interactionTimer.current)window.clearTimeout(interactionTimer.current);
    interactionTimer.current=null;
    setUserStoppedLoop(true);
    setInteractionPaused(true);
  };
  useEffect(()=>()=>{if(interactionTimer.current)window.clearTimeout(interactionTimer.current);},[]);
  useEffect(()=>{
    const el=rail.current;
    if(beauty&&!initialBeautyPositioned.current){el.scrollLeft=0;initialBeautyPositioned.current=true;}
    const update=()=>{
      const nextEdges={previous:el.scrollLeft>2,next:el.scrollLeft+el.clientWidth<el.scrollWidth-2};
      setEdges(previous=>previous.previous===nextEdges.previous&&previous.next===nextEdges.next?previous:nextEdges);
    };
    update();
    const observer=new ResizeObserver(update);
    observer.observe(el);
    el.addEventListener('scroll',update,{passive:true});
    if(!autoLoop&&!hinted.current && el.scrollWidth>el.clientWidth+2 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      hinted.current=true;
      el.firstElementChild.animate([{transform:'translateX(0)'},{transform:'translateX(-24px)'},{transform:'translateX(0)'}],{duration:740,delay:400,easing:'ease-in-out'});
    }
    return()=>{observer.disconnect();el.removeEventListener('scroll',update);};
  },[shops,beauty,autoLoop]);
  const move=direction=>{
    const el=rail.current,card=el.querySelector('article');
    stopAfterManualMove();
    if(card)el.scrollBy({left:direction*(card.offsetWidth+12),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  };
  const onFocusEnter=()=>{focusInside.current=true;suspendForInteraction();};
  const onFocusLeave=event=>{if(!event.currentTarget.contains(event.relatedTarget)){focusInside.current=false;resumeAfterInteraction();}};
  const onPointerEnter=()=>{pointerInside.current=true;suspendForInteraction();};
  const onPointerLeave=()=>{pointerInside.current=false;resumeAfterInteraction();};
  const onPointerDown=()=>{pointerStart.current=rail.current?.scrollLeft??null;suspendForInteraction();};
  const onPointerEnd=event=>{
    const start=pointerStart.current;
    pointerStart.current=null;
    if(event.pointerType==='touch')pointerInside.current=false;
    if(start!==null&&Math.abs((rail.current?.scrollLeft??start)-start)>2){stopAfterManualMove();return;}
    resumeAfterInteraction();
  };
  const onWheel=event=>{
    if(Math.abs(event.deltaX)>0||(event.shiftKey&&Math.abs(event.deltaY)>0))stopAfterManualMove();
  };
  const onKeyDown=event=>{
    if(['ArrowLeft','ArrowRight','PageUp','PageDown','Home','End'].includes(event.key))stopAfterManualMove();
  };
  return <section className="meryo-discovery-shelf" aria-labelledby={titleId}>
    <div className="meryo-discovery-heading">
      <div><h2 id={titleId}>{title}</h2><p>{description}</p></div>
      {(edges.previous||edges.next)&&<div className="meryo-rail-controls">
        {loopReady&&!userStoppedLoop&&<button type="button" className="meryo-loop-toggle" onClick={()=>setUserPausedLoop(value=>!value)} aria-label={`${userPausedLoop?'Reanudar':'Pausar'} movimiento de ${beauty?'salones':'barberías'} ${sectionKind}`}>
          {isPlaying?<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>:<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m8 5 12 7-12 7z"/></svg>}
        </button>}
        <button type="button" disabled={!edges.previous} onClick={()=>move(-1)} aria-label={`${beauty?'Salones':'Barberías'} ${sectionKind} anteriores`}>‹</button>
        <button type="button" disabled={!edges.next} onClick={()=>move(1)} aria-label={`Más ${beauty?'salones':'barberías'} ${sectionKind}`}>›</button>
      </div>}
    </div>
    {(edges.previous||edges.next)&&<p className="meryo-rail-hint">{loopReady&&!userStoppedLoop?'Se desplaza despacio. Al deslizarlo, el movimiento automático se detiene.':`Desliza para ver más ${beauty?'salones':'barberías'} ${sectionKind}.`}</p>}
    <div className={`meryo-featured-rail${beauty?' meryo-featured-rail--beauty':''}${autoLoop?' meryo-featured-rail--loop':''}`} ref={rail} tabIndex={shops.length>1?0:undefined} aria-label={`Carrusel de ${beauty?'salones':'barberías'} ${sectionKind}`} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onPointerDown={onPointerDown} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} onWheel={onWheel} onKeyDown={onKeyDown} onFocusCapture={onFocusEnter} onBlurCapture={onFocusLeave}>
      {autoLoop?<div className="meryo-featured-loop-track">
        <div className="meryo-featured-loop-group" ref={loopGroup}><CatalogShopGrid shops={shops} category={category} onView={onView} onReserve={onReserve} renderLike={renderLike}/></div>
        {Array.from({length:loopCloneCount},(_,index)=><div key={`loop-copy-${index}`} className="meryo-featured-loop-group meryo-featured-loop-group--copy" aria-hidden="true"><CatalogShopGrid shops={shops} category={category} onView={onView} onReserve={onReserve} renderLike={renderLike} decorativeClone/></div>)}
      </div>:<CatalogShopGrid shops={shops} category={category} onView={onView} onReserve={onReserve} renderLike={renderLike}/>}
    </div>
  </section>;
}

export default function BarberCatalogHighlights({api,shops,identity,onLogin,onView,onReserve,category='barberia'}) {
  const [data,setData]=useState(null);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const mutation=useRef(false);
  useEffect(()=>{
    let active=true;
    const request=category==='barberia'?api.barberHighlights():api.catalogHighlights(category);
    request.then(rows=>{if(active)setData(rows);}).catch(()=>{if(active)setData(null);});
    return()=>{active=false;};
  },[api,identity?.id,category]);

  const stats=new Map(data?.map(row=>[String(row.shop_id),row]));
  const featured=shops.filter(shop=>stats.get(String(shop.id))?.featured);
  const liked=shops.filter(shop=>Number(stats.get(String(shop.id))?.likes)>0)
    .sort((a,b)=>Number(stats.get(String(b.id)).likes)-Number(stats.get(String(a.id)).likes)||a.name.localeCompare(b.name,'es')).slice(0,10);
  const vote=async shop=>{
    if(identity?.rol!=='cliente'){onLogin();return;}
    if(mutation.current)return;
    mutation.current=true;setBusy(true);setMessage('');
    try{
      const likedNow=!stats.get(String(shop.id))?.liked;
      if(category==='barberia')await api.setBarberLike(shop.id,likedNow);
      else await api.setCatalogLike(shop.id,likedNow,category);
      setData(await (category==='barberia'?api.barberHighlights():api.catalogHighlights(category)));
    }catch{setMessage('No pudimos actualizar tu Me gusta. Inténtalo de nuevo.');}
    finally{mutation.current=false;setBusy(false);}
  };
  const renderLike=(shop,{decorativeClone=false}={})=>{
    const info=stats.get(String(shop.id));
    return <button type="button" tabIndex={decorativeClone?-1:undefined} className="meryo-catalog-like" disabled={busy} aria-pressed={!!info?.liked} aria-label={`Me gusta: ${shop.name}`} onClick={()=>void vote(shop)}><span aria-hidden="true">{info?.liked?'♥':'♡'}</span> {Number(info?.likes||0)}</button>;
  };
  const categoryLabel=category==='belleza'?'salones':'barberías';
  const featuredTitleId=`meryo-${category}-featured-title`;
  const likesTitleId=`meryo-${category}-likes-title`;
  const emptyShelf=(id,title,description,emptyText)=><section className="meryo-discovery-shelf" aria-labelledby={id}><div className="meryo-discovery-heading"><div><h2 id={id}>{title}</h2><p>{description}</p></div></div><p className="meryo-discovery-empty">{emptyText}</p></section>;

  return <>
    {shops.length>0&&data!==null&&featured.length>0&&<Featured shops={featured} category={category} onView={onView} onReserve={onReserve} title="DESTACADOS" titleId={featuredTitleId} description={category==='belleza'?'Salones con campaña promocionada.':'Barberías con campaña promocionada.'}/>}
    {shops.length>0&&data!==null&&featured.length===0&&emptyShelf(featuredTitleId,'DESTACADOS',category==='belleza'?'Campañas promocionadas de peluquerías y salones.':'Campañas promocionadas de barberías.',category==='belleza'?'Todavía no hay salones destacados.':'Todavía no hay barberías destacadas.')}
    {liked.length>0&&<Featured shops={liked} category={category} onView={onView} onReserve={onReserve} renderLike={renderLike} title="MÁS ME GUSTA" titleId={likesTitleId} description={category==='belleza'?'Ordenados por los Me gusta de clientes.':'Ordenadas por los Me gusta de clientes.'}/>}
    {shops.length>0&&data!==null&&liked.length===0&&emptyShelf(likesTitleId,'MÁS ME GUSTA',category==='belleza'?'Peluquerías y salones que reciben Me gusta de clientes.':'Barberías que reciben Me gusta de clientes.',`Todavía no hay ${categoryLabel} con Me gusta.`)}
    {shops.length>0&&(featured.length>0||liked.length>0)&&<div className="meryo-discovery-heading"><h2>{category==='belleza'?'Todos los salones':'Todas las barberías'}</h2></div>}
    {message&&<p role="status">{message}</p>}
    <CatalogShopGrid shops={shops} category={category} onView={onView} onReserve={onReserve} renderLike={renderLike}/>
  </>;
}
