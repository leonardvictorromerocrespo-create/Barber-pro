import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import './CatalogDiscoverLayer.css';

const slides=[
  {src:'/campaign-carousel/inspiracion.png',alt:'Inspiración: barberías y peluquerías.'},
  {src:'/campaign-carousel/turnos-para-hoy.png',alt:'Turnos para hoy: barberías, peluquerías y horarios.'},
  {src:'/campaign-carousel/promociones.png',alt:'Promociones de barberías y peluquerías.'},
  {src:'/meryo-intelligence-welcome.png',alt:'Asesora de estilo de MERYO.'},
];

export default function CatalogDiscoverLayer({category,themeMode,themeAppearance,open,onOpenChange,control,children}) {
  const [peeking,setPeeking]=useState(()=>typeof window!=='undefined'&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [panelHeight,setPanelHeight]=useState(0);
  const [dragProgress,setDragProgress]=useState(null);
  const handleRef=useRef(null);
  const panelRef=useRef(null);
  const carouselRef=useRef(null);
  const dragStart=useRef(null);
  const suppressClickUntil=useRef(0);

  useEffect(()=>{
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return undefined;
    const timer=window.setTimeout(()=>setPeeking(false),1900);
    return()=>window.clearTimeout(timer);
  },[category]);

  useLayoutEffect(()=>{
    const updatePanelMetrics=()=>{
      const rect=handleRef.current?.getBoundingClientRect();
      const panel=panelRef.current;
      if(rect&&panel){
        const bottom=Number.parseFloat(window.getComputedStyle(panel).bottom)||0;
        const top=Math.round(rect.bottom)+12;
        setPanelHeight(Math.max(0,window.innerHeight-top-bottom));
      }
    };
    updatePanelMetrics();
    const previousOverflow=document.body.style.overflow;
    if(open)document.body.style.overflow='hidden';
    window.addEventListener('resize',updatePanelMetrics);
    window.addEventListener('scroll',updatePanelMetrics,true);
    const closeOnEscape=event=>{if(open&&event.key==='Escape'){onOpenChange(false);handleRef.current?.focus();}};
    if(open)window.addEventListener('keydown',closeOnEscape);
    return()=>{
      if(open)document.body.style.overflow=previousOverflow;
      window.removeEventListener('resize',updatePanelMetrics);
      window.removeEventListener('scroll',updatePanelMetrics,true);
      window.removeEventListener('keydown',closeOnEscape);
    };
  },[open,onOpenChange]);

  useEffect(()=>{
    if(!open||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return undefined;
    const viewport=carouselRef.current;
    if(!viewport)return undefined;
    let frame=0,lastTime=0,position=viewport.scrollLeft,renderedPosition=viewport.scrollLeft;
    const move=time=>{
      if(lastTime){
        const actualPosition=viewport.scrollLeft;
        if(Math.abs(actualPosition-renderedPosition)>2)position=actualPosition;
        position+=(time-lastTime)*.018;
        const loopWidth=viewport.scrollWidth/2;
        if(loopWidth>0&&position>=loopWidth)position-=loopWidth;
        viewport.scrollLeft=position;
        renderedPosition=viewport.scrollLeft;
      }
      lastTime=time;
      frame=window.requestAnimationFrame(move);
    };
    frame=window.requestAnimationFrame(move);
    return()=>window.cancelAnimationFrame(frame);
  },[open]);

  const openFromSlider=()=>{setPeeking(false);onOpenChange(true);};
  const onPointerDown=event=>{
    setPeeking(false);
    const rect=event.currentTarget.getBoundingClientRect();
    const knobWidth=event.currentTarget.querySelector('.meryo-discover__knob')?.getBoundingClientRect().width??82;
    const travel=Math.max(1,rect.width-knobWidth-6);
    dragStart.current={x:event.clientX,start:open?travel:0,travel,progress:open?1:0,moved:false};
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove=event=>{
    if(!dragStart.current)return;
    const drag=dragStart.current;
    const delta=event.clientX-drag.x;
    if(Math.abs(delta)>4)drag.moved=true;
    drag.progress=Math.max(0,Math.min(1,(drag.start+delta)/drag.travel));
    setDragProgress(drag.progress);
  };
  const onPointerUp=()=>{
    if(!dragStart.current)return;
    const drag=dragStart.current;
    if(drag.moved){
      onOpenChange(drag.progress>=.5);
      suppressClickUntil.current=Date.now()+350;
    }
    dragStart.current=null;
    setDragProgress(null);
  };
  const onKeyDown=event=>{
    setPeeking(false);
    if(event.key==='ArrowRight'||event.key==='End'){event.preventDefault();openFromSlider();}
    else if(event.key==='ArrowLeft'||event.key==='Home'){event.preventDefault();onOpenChange(false);}
    else if(event.key===' '||event.key==='Enter'){event.preventDefault();onOpenChange(!open);}
  };

  const progress=dragProgress??(open?1:0);
  const panel=<div ref={panelRef} id="meryo-discover-panel" data-meryo-theme={category==='belleza'?'beauty':'barberia'} data-meryo-mode={themeMode} data-meryo-appearance={themeAppearance} className={`meryo-discover__panel${open?' is-open':''}${dragProgress!==null?' is-dragging':''}${peeking?' is-peeking':''}`} style={{'--meryo-discover-panel-height':`${panelHeight}px`,'--meryo-discover-panel-current-height':`${panelHeight*progress}px`}} aria-hidden={!open} inert={!open}>
    <div className="meryo-discover__content">
      <h2>Descubre nuestras funciones</h2>
      <div ref={carouselRef} className="meryo-discover__carousel" role="region" aria-label="Funciones de MERYO; desliza horizontalmente" tabIndex="0">
        <div className="meryo-discover__carousel-track">
          {[0,1].map(copy=><div className="meryo-discover__carousel-group" key={copy} aria-hidden={copy===1}>
            {slides.map(slide=><div className="meryo-discover__slide" key={`${copy}-${slide.src}`}>
              <img src={slide.src} alt={copy===0?slide.alt:''} loading="lazy" decoding="async" draggable="false"/>
            </div>)}
          </div>)}
        </div>
      </div>
      <div className="meryo-discover__actions">{children}</div>
    </div>
  </div>;

  return <>
    <div className="meryo-discover" data-category={category}>
      <p className="meryo-discover__label">Nuestras Funciones</p>
      <div className="meryo-discover__switch-row">
        {control}
        <div ref={handleRef} className="meryo-discover__track" role="slider" aria-label="Desliza para abrir o cerrar las funciones" aria-controls="meryo-discover-panel" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress*100)} aria-valuetext={open?'Funciones abiertas':'Funciones cerradas'} tabIndex="0"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onLostPointerCapture={onPointerUp} onKeyDown={onKeyDown}
          onClick={()=>{if(Date.now()<suppressClickUntil.current)return;setPeeking(false);onOpenChange(!open);}}>
          <span className="meryo-discover__knob" style={{transform:`translateX(${progress*4.31}rem)`}}><span>{open?'Volver':'Deslizar'}</span></span>
        </div>
      </div>
    </div>
    {typeof document!=='undefined'&&createPortal(panel,document.body)}
  </>;
}
