import {useEffect,useState} from 'react';
import {bookingOriginLabels,taggedBookingUrl} from '../../lib/booking-origin.js';
import {fechaLima} from '../../lib/dates.js';
import {btnGhost,card,inputClass} from './ui';

const number=new Intl.NumberFormat('es-PE');
const months=new Intl.DateTimeFormat('es-PE',{month:'long',year:'numeric',timeZone:'UTC'});
const sources=Object.entries(bookingOriginLabels);
const linkSources=['ficha_google','whatsapp','instagram'];

export default function BookingResults({api,shop}){
 const [currentMonth]=useState(()=>fechaLima(Date.now()).slice(0,7));
 const [month,setMonth]=useState(currentMonth),[retry,setRetry]=useState(0);
 const [response,setResponse]=useState(null),[copied,setCopied]=useState('');
 const availableCategories=['barberia','belleza'].filter(category=>(shop.tipos_negocio??['barberia']).includes(category));
 const [selectedCategory,setSelectedCategory]=useState(null);
 const category=availableCategories.includes(selectedCategory)?selectedCategory:availableCategories[0];
 const requestKey=`${shop.id}/${month}/${retry}`;
 useEffect(()=>{
  let active=true;
  api.bookingResults(shop.id,month+'-01').then(rows=>{
   if(active)setResponse({key:requestKey,rows,error:''});
  }).catch(error=>{
   if(active)setResponse({key:requestKey,rows:[],error:error.message||'No pudimos consultar los resultados.'});
  });
  return()=>{active=false;};
 },[api,shop.id,month,requestKey]);

 const current=response?.key===requestKey?response:null;
 const counts=new Map((current?.rows??[]).map(row=>[row.origen,row]));
 const rows=sources.map(([id,label])=>({id,label,requests:Number(counts.get(id)?.solicitadas??0),completed:Number(counts.get(id)?.completadas??0)}));
 const requests=rows.reduce((sum,row)=>sum+row.requests,0);
 const completed=rows.reduce((sum,row)=>sum+row.completed,0);
 const top=Math.max(1,...rows.map(row=>row.completed));
 const origin=typeof window==='undefined'?undefined:window.location.origin;
 async function copy(url,label){
  try{await navigator.clipboard.writeText(url);setCopied('Enlace de '+label+' copiado.');}
  catch{setCopied('Selecciona el enlace y cópialo manualmente.');}
 }
 return <div className="space-y-5">
  <section className={`${card} space-y-5`} aria-labelledby="booking-results-title">
   <div className="flex flex-wrap items-end justify-between gap-4">
    <div><p className="text-sm font-semibold text-amber-300">Citas por canal</p><h2 id="booking-results-title" className="text-2xl font-bold">Resultados</h2></div>
    <label className="min-w-0 text-sm">Mes<input type="month" max={currentMonth} className={inputClass} value={month}
      onChange={event=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)&&event.target.value<=currentMonth)setMonth(event.target.value);}}/></label>
   </div>
   <p className="text-sm text-neutral-400">Citas con horario en {months.format(new Date(month+'-01T12:00:00Z'))} (hora de Lima).</p>
   {!current?<p role="status">Consultando resultados…</p>:current.error?<div className="space-y-3">
    <p role="alert">No pudimos cargar los resultados. {current.error}</p>
    <button type="button" className={btnGhost} onClick={()=>setRetry(value=>value+1)}>Reintentar</button>
   </div>:<>
    <dl className="grid grid-cols-2 gap-3">
     <div className="rounded-xl bg-neutral-900 p-4"><dt className="text-sm text-neutral-300">Solicitudes</dt><dd className="text-2xl font-bold tabular-nums">{number.format(requests)}</dd></div>
     <div className="rounded-xl bg-neutral-900 p-4"><dt className="text-sm text-neutral-300">Citas completadas</dt><dd className="text-2xl font-bold tabular-nums text-amber-300">{number.format(completed)}</dd></div>
    </dl>
    {!requests?<p className="text-sm text-neutral-300">Todavía no hay citas para este mes.</p>:
    <table className="w-full table-fixed text-sm">
     <caption className="sr-only">Solicitudes y citas completadas por canal</caption>
     <thead className="text-neutral-300"><tr>
      <th scope="col" className="w-[42%] py-2 text-left">Canal</th>
      <th scope="col" className="py-2 text-right">Solicitudes</th>
      <th scope="col" className="py-2 text-right">Completadas</th>
     </tr></thead>
     <tbody className="divide-y divide-neutral-800">{rows.map(row=><tr key={row.id}>
      <th scope="row" className="py-3 pr-2 text-left font-medium">{row.label}
       <span aria-hidden="true" className="mt-2 block h-1 overflow-hidden rounded-full bg-neutral-800"><span className="block h-full rounded-full bg-amber-400" style={{width:`${row.completed/top*100}%`}}/></span>
      </th>
      <td className="text-right tabular-nums">{number.format(row.requests)}</td>
      <td className="text-right font-semibold tabular-nums">{number.format(row.completed)}</td>
     </tr>)}</tbody>
    </table>}
    <p className="text-xs text-neutral-400">El canal indica cómo se abrió la reserva. «Ficha de Google» reúne Search y Maps; no indica si el cliente era nuevo.</p>
   </>}
  </section>
  <section className={`${card} space-y-4`} aria-labelledby="booking-links-title">
   <h2 id="booking-links-title" className="text-xl font-bold">Enlaces de reserva</h2>
   <p className="text-sm text-neutral-400">Usa el enlace de cada canal para abrir la reserva de tu local y medir las citas que llegan por ahí.</p>
   {shop.estado!=='activa'||!shop.verificada||!category?<p className="text-sm">Los enlaces estarán disponibles cuando el negocio esté publicado.</p>:<>
    {availableCategories.length>1&&<label className="block text-sm">Categoría<select className={inputClass} value={category}
      onChange={event=>{setSelectedCategory(event.target.value);setCopied('');}}><option value="barberia">Barberías</option><option value="belleza">Belleza</option></select></label>}
    <ul className="space-y-3">{linkSources.map(source=>{
     const label=bookingOriginLabels[source],url=taggedBookingUrl(shop,category,source,origin);
     return <li key={source} className="rounded-lg bg-neutral-900 p-3">
      <label className="block text-sm font-medium" htmlFor={'booking-link-'+source}>{label}</label>
      <div className="mt-2 flex flex-wrap gap-2">
       <input id={'booking-link-'+source} className="min-w-0 flex-1 rounded-lg bg-neutral-950 px-3 py-2 text-sm" value={url} readOnly onFocus={event=>event.target.select()}/>
       <button type="button" className={btnGhost} aria-label={'Copiar enlace de '+label} onClick={()=>void copy(url,label)}>Copiar</button>
      </div>
     </li>;
    })}</ul>
    <p className="text-xs text-neutral-400">Para Google, pega el enlace en la sección Reservas de la ficha de tu negocio.</p>
    <p role="status" className="text-sm text-amber-300">{copied}</p>
   </>}
  </section>
 </div>;
}
