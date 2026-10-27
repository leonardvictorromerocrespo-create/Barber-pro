import {useEffect,useRef} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
export default function LocationPicker({lat,lng,onChange}){
 const element=useRef(null),map=useRef(null),point=useRef(null),change=useRef(onChange);
 useEffect(()=>{change.current=onChange;},[onChange]);
 useEffect(()=>{const instance=L.map(element.current,{scrollWheelZoom:false}).setView([-12.0464,-77.0428],12);map.current=instance;L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(instance);instance.on('click',e=>change.current(e.latlng));return()=>{instance.remove();map.current=null;point.current=null;};},[]);
 useEffect(()=>{if(!map.current||lat===''||lng===''||lat==null||lng==null)return;const a=Number(lat),b=Number(lng);if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a)>90||Math.abs(b)>180)return;if(point.current)point.current.remove();point.current=L.circleMarker([a,b],{color:'#fbbf24',radius:9}).addTo(map.current);map.current.setView([a,b],15);},[lat,lng]);
 return <div><p className="mb-2 text-sm text-neutral-400">Toca el mapa para indicar la ubicación exacta. También puedes editar las coordenadas.</p><div ref={element} role="region" aria-label="Elegir ubicación de mi barbería" className="relative z-0 h-64 rounded-xl"/></div>;
}
