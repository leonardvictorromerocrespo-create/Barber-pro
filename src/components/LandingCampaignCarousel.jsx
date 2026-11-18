import {useEffect,useRef,useState} from 'react';
import './LandingCampaignCarousel.css';

const slides=[
  {src:'/campaign-carousel/inspiracion.png',alt:'Inspiración: estilos para barberías y peluquerías.'},
  {src:'/campaign-carousel/turnos-para-hoy.png',alt:'Turnos para hoy: encuentra un horario en una barbería o peluquería.'},
  {src:'/campaign-carousel/promociones.png',alt:'Promociones para servicios de barbería y peluquería.'},
];

export default function LandingCampaignCarousel(){
  const [index,setIndex]=useState(0);
  const [playing,setPlaying]=useState(true);
  const pointerStart=useRef(null);

  useEffect(()=>{
    if(!playing||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return undefined;
    const timer=window.setInterval(()=>setIndex(current=>(current+1)%slides.length),3000);
    return()=>window.clearInterval(timer);
  },[playing]);

  const move=direction=>{
    setPlaying(false);
    setIndex(current=>(current+direction+slides.length)%slides.length);
  };
  const slide=slides[index];
  const handlePointerDown=event=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    pointerStart.current=event.clientX;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const handlePointerUp=event=>{
    if(pointerStart.current===null)return;
    const distance=event.clientX-pointerStart.current;
    pointerStart.current=null;
    if(Math.abs(distance)>=36)move(distance<0?1:-1);
  };
  const handleKeyDown=event=>{
    if(event.key==='ArrowRight'){event.preventDefault();move(1);}
    if(event.key==='ArrowLeft'){event.preventDefault();move(-1);}
  };

  return <section className="meryo-campaign-carousel" role="group" tabIndex={0} aria-label="Imágenes de Inspiración, Turnos para hoy y Promociones" aria-roledescription="carrusel" aria-live="off" onKeyDown={handleKeyDown} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerCancel={()=>{pointerStart.current=null;}}>
    <div className="meryo-campaign-carousel__frame">
      <img key={slide.src} src={slide.src} alt={slide.alt} fetchPriority={index===0?'high':'auto'} decoding="async" draggable="false"/>
    </div>
  </section>;
}
