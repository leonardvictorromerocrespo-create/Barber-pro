import {useEffect,useState} from 'react';
import beautyInspiration from '../assets/beauty-carousel/salon-styling.webp';
import './LandingCampaignCarousel.css';

const slides=[
  {src:'/campaign-carousel/inspiracion.png',alt:'Inspiración: estilos para barberías y peluquerías.'},
  {src:beautyInspiration,alt:'Una estilista realiza un peinado a una clienta en un salón.',title:'Inspiración para peluquerías',description:'Ideas y trabajos de profesionales de belleza.'},
  {src:'/campaign-carousel/turnos-para-hoy.png',alt:'Turnos para hoy: encuentra un horario en una barbería o peluquería.'},
  {src:'/campaign-carousel/promociones.png',alt:'Promociones para servicios de barbería y peluquería.'},
];

export default function LandingCampaignCarousel(){
  const [index,setIndex]=useState(0);
  const [playing,setPlaying]=useState(true);

  useEffect(()=>{
    if(!playing||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return undefined;
    const timer=window.setInterval(()=>setIndex(current=>(current+1)%slides.length),3000);
    return()=>window.clearInterval(timer);
  },[playing]);

  const select=next=>{
    setPlaying(false);
    setIndex((next+slides.length)%slides.length);
  };
  const slide=slides[index];

  return <section className="meryo-campaign-carousel" aria-label="Novedades de MERYO" aria-roledescription="carrusel" onPointerDown={()=>setPlaying(false)} onFocusCapture={()=>setPlaying(false)}>
    <div className={`meryo-campaign-carousel__frame${slide.title?' meryo-campaign-carousel__frame--captioned':''}`}>
      <img key={slide.src} src={slide.src} alt={slide.alt} fetchPriority={index===0?'high':'auto'} decoding="async"/>
      {slide.title&&<div className="meryo-campaign-carousel__caption"><h2>{slide.title}</h2><p>{slide.description}</p></div>}
    </div>
    <div className="meryo-campaign-carousel__controls" role="group" aria-label="Controles del carrusel">
      <button type="button" className="meryo-campaign-carousel__arrow" onClick={()=>select(index-1)} aria-label="Imagen anterior">‹</button>
      <div className="meryo-campaign-carousel__dots">
        {slides.map((item,itemIndex)=><button key={item.src} type="button" className={index===itemIndex?'is-active':''} aria-label={`Mostrar imagen ${itemIndex+1} de ${slides.length}`} aria-current={index===itemIndex?'true':undefined} onClick={()=>select(itemIndex)}/>) }
      </div>
      <button type="button" className="meryo-campaign-carousel__arrow" onClick={()=>select(index+1)} aria-label="Imagen siguiente">›</button>
      <button type="button" className="meryo-campaign-carousel__play" onClick={()=>setPlaying(value=>!value)} aria-label={playing?'Pausar carrusel':'Reanudar carrusel'}>{playing?'Pausar':'Reanudar'}</button>
    </div>
  </section>;
}
