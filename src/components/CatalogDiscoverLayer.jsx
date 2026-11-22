import {useEffect,useRef,useState} from 'react';
import './CatalogDiscoverLayer.css';

const slides=[
  {src:'/campaign-carousel/inspiracion.png',alt:'Inspiración: barberías y peluquerías.'},
  {src:'/campaign-carousel/turnos-para-hoy.png',alt:'Turnos para hoy: barberías, peluquerías y horarios.'},
  {src:'/campaign-carousel/promociones.png',alt:'Promociones de barberías y peluquerías.'},
  {src:'/meryo-intelligence-welcome.png',alt:'Asesora de estilo de MERYO.'},
];

export default function CatalogDiscoverLayer({category,children}) {
  const [open,setOpen]=useState(false);
  const [peeking,setPeeking]=useState(()=>typeof window!=='undefined'&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const dragStart=useRef(null);
  const suppressClickUntil=useRef(0);
  const handleRef=useRef(null);

  useEffect(()=>{
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return undefined;
    const timer=window.setTimeout(()=>setPeeking(false),1800);
    return()=>window.clearTimeout(timer);
  },[category]);

  useEffect(()=>{
    if(!open)return undefined;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const closeOnEscape=event=>{if(event.key==='Escape'){setOpen(false);handleRef.current?.focus();}};
    window.addEventListener('keydown',closeOnEscape);
    return()=>{
      document.body.style.overflow=previousOverflow;
      window.removeEventListener('keydown',closeOnEscape);
    };
  },[open]);

  const onPointerDown=event=>{
    dragStart.current=event.clientY;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerUp=event=>{
    if(dragStart.current===null)return;
    const distance=event.clientY-dragStart.current;
    dragStart.current=null;
    if(Math.abs(distance)<38)return;
    suppressClickUntil.current=Date.now()+350;
    setOpen(distance>0);
  };

  return <section className={`meryo-discover${open?' is-open':''}${peeking&&!open?' is-peeking':''}`} data-category={category}>
    <button ref={handleRef} type="button" className="meryo-discover__handle" aria-expanded={open} aria-controls="meryo-discover-panel"
      onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={()=>{dragStart.current=null;}}
      onClick={()=>{if(Date.now()<suppressClickUntil.current)return;setOpen(value=>!value);}}>
      <span>Nuestras funciones</span>
    </button>
    <div id="meryo-discover-panel" className="meryo-discover__panel" aria-hidden={!open} inert={!open}>
      <div className="meryo-discover__content">
        <h2>Descubre nuestras funciones</h2>
        <div className="meryo-discover__carousel" role="region" aria-label="Funciones de MERYO; desliza horizontalmente" tabIndex="0">
          {slides.map(slide=><div className="meryo-discover__slide" key={slide.src}>
            <img src={slide.src} alt={slide.alt} loading="lazy" decoding="async" draggable="false"/>
          </div>)}
        </div>
        <div className="meryo-discover__actions">{children}</div>
      </div>
    </div>
  </section>;
}
