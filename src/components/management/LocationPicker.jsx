import {useCallback,useEffect,useReducer,useRef,useState} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {coordinates} from '../../lib/catalog';
import {initialLocation,locationReady,selectLocation} from '../../lib/location-selection';

export default function LocationPicker({lat,lng,onChange,onReady,savedLocation=false}){
 const element=useRef(null),map=useRef(null),marker=useRef(null),tiles=useRef(null),callbacks=useRef({onChange,onReady}),request=useRef(0);
 const [initialSelection]=useState(()=>initialLocation({lat,lng},savedLocation));
 const [selection,dispatch]=useReducer(selectLocation,initialSelection);
 const [tileLoading,setTileLoading]=useState(true),[tileError,setTileError]=useState(false);
 const ready=locationReady(selection);
 useEffect(()=>{callbacks.current={onChange,onReady};},[onChange,onReady]);
 useEffect(()=>{callbacks.current.onReady?.(ready);},[ready]);
 const invalidateRequest=useCallback(()=>{request.current++;},[]);
 const choose=useCallback(point=>{const valid=coordinates(point);if(!valid)return;invalidateRequest();dispatch({type:'manual',point:valid});callbacks.current.onChange(valid);},[invalidateRequest]);
 useEffect(()=>{
  const initial=initialSelection.point;
  const instance=L.map(element.current,{scrollWheelZoom:true,touchZoom:true,minZoom:3,maxZoom:19,zoomAnimation:false,fadeAnimation:false}).setView(initial?[initial.lat,initial.lng]:[-12.0464,-77.0428],initial?17:12);
  map.current=instance;
  const layer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,maxNativeZoom:19,updateWhenZooming:true,attribution:'© OpenStreetMap'});
  tiles.current=layer;
  layer.on('loading',()=>{setTileLoading(true);setTileError(false);});
  layer.on('tileerror',()=>setTileError(true));layer.on('load',()=>setTileLoading(false));layer.addTo(instance);
  instance.on('click',e=>choose(e.latlng));
  const resize=typeof ResizeObserver==='undefined'?null:new ResizeObserver(()=>instance.invalidateSize({pan:false}));resize?.observe(element.current);
  return()=>{invalidateRequest();resize?.disconnect();instance.remove();map.current=null;marker.current=null;tiles.current=null;};
 },[initialSelection,choose,invalidateRequest]);
 useEffect(()=>{
  if(!map.current)return;const point=selection.point||selection.candidate;
  if(!point){marker.current?.remove();marker.current=null;return;}
  if(marker.current)marker.current.setLatLng([point.lat,point.lng]);
  else{marker.current=L.marker([point.lat,point.lng],{draggable:true,keyboard:true,title:'Ubicación de la barbería: arrastra para ajustar',icon:L.divIcon({className:'',html:'<span style="display:block;width:24px;height:24px;border:3px solid white;border-radius:50%;background:#fbbf24;box-shadow:0 2px 8px #000"></span>',iconSize:[24,24],iconAnchor:[12,12]})}).addTo(map.current);marker.current.on('dragend',()=>choose(marker.current.getLatLng()));}
 },[selection.point,selection.candidate,choose]);
 function locate(){
  const version=++request.current;dispatch({type:'start'});
  if(!navigator.geolocation){dispatch({type:'failed',message:'Este navegador no permite obtener tu ubicación. Selecciona el local en el mapa.'});return;}
  navigator.geolocation.getCurrentPosition(p=>{
   if(!map.current||version!==request.current)return;const point=coordinates({lat:p.coords.latitude,lng:p.coords.longitude});
   dispatch({type:'found',point});if(point)map.current.setView([point.lat,point.lng],17);
  },e=>{if(!map.current||version!==request.current)return;dispatch({type:'failed',message:e.code===1?'No autorizaste la ubicación. El local todavía no está confirmado; selecciónalo en el mapa.':'No se pudo obtener tu ubicación. El local todavía no está confirmado; selecciónalo en el mapa.'});},{enableHighAccuracy:true,timeout:15000,maximumAge:60000});
 }
 function confirm(){if(!selection.candidate)return;callbacks.current.onChange(selection.candidate);dispatch({type:'confirm'});}
 const message=selection.status==='saved'?'Ubicación guardada del local. Puedes mover el marcador para cambiarla.':ready?'Ubicación del local seleccionada. Puedes mover el marcador antes de guardar.':selection.status==='candidate'?'Posición obtenida. Confirma que corresponde al local o mueve el marcador.':selection.status==='locating'?'Buscando la ubicación del dispositivo; el local aún no está confirmado.':'Selecciona la ubicación del local en el mapa. Lima es solo el punto inicial de la vista.';
 return <div className="space-y-3"><p className="text-sm text-neutral-400">Toca el mapa para ubicar el local y arrastra el marcador para ajustarlo. La ubicación de tu teléfono puede ser distinta de la barbería. Acerca con +, la rueda o dos dedos para distinguir las calles.</p><button type="button" onClick={locate} disabled={selection.status==='locating'} className="rounded-xl border border-white/20 px-4 py-2 disabled:opacity-40">{selection.status==='locating'?'Buscando ubicación…':'Usar mi ubicación'}</button><div ref={element} role="region" aria-label="Elegir ubicación de mi barbería" className="relative z-0 h-64 rounded-xl"/>{tileLoading&&<p role="status" className="text-sm text-neutral-400">Cargando detalle del mapa…</p>}{tileError&&<div role="alert" className="text-sm text-red-300"><p>No se pudo cargar parte del detalle del mapa. Revisa tu conexión y vuelve a cargar las calles.</p><button type="button" className="mt-2 underline" onClick={()=>tiles.current?.redraw()}>Reintentar mapa</button></div>}<p role="status" className="text-sm text-amber-300">{message}</p>{selection.status==='candidate'&&<button type="button" onClick={confirm} className="rounded-xl border border-amber-400 px-4 py-2 text-amber-300">Confirmar esta ubicación</button>}{selection.error&&<p role="alert" className="text-sm text-red-300">{selection.error}</p>}</div>;
}