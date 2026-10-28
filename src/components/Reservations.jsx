import {useCallback,useEffect,useRef,useState} from 'react';
import {bookingLabel} from '../lib/meryo-api';
import {remainingSeconds,countdown} from '../lib/booking-time';
import {bookingIdFromSearch,bookingDeadline} from '../lib/booking-link';
import {visiblePolling} from '../lib/visible-polling';

export default function Reservations({api,profile,onLogin,onSearch,memberId,identityLoading=false}){
 const [focus,setFocus]=useState(()=>typeof window!=='undefined'?bookingIdFromSearch(window.location.search):null);
 const focused=useRef(false);
 const polling=useRef(null);
 const [rows,setRows]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [anchor,setAnchor]=useState(null),[now,setNow]=useState(0);
 const visibleRows=rows.filter(r=>(!memberId||r.barbero_id===memberId)&&(!focus||r.id===focus));
 const load=useCallback(async()=>{
  setLoading(true);
  try{const data=await api.bookingState();setRows(data.reservas);setAnchor({serverMs:Date.parse(data.server_now),received:performance.now()});setNow(performance.now());setError('');}
  catch(e){setError(e.message);}finally{setLoading(false);}
 },[api]);
 useEffect(()=>{
  if(!profile||!['cliente','barbero'].includes(profile.rol))return;
  const reader=visiblePolling(load);polling.current=reader;
  const clock=setInterval(()=>setNow(performance.now()),1000);
  return()=>{reader.stop();if(polling.current===reader)polling.current=null;clearInterval(clock);};
 },[load,api,profile]);
 const refresh=()=>polling.current?.refresh()||Promise.resolve();
 useEffect(()=>{if(focus&&!focused.current&&rows.some(r=>r.id===focus)){document.getElementById('cita-'+focus)?.scrollIntoView({block:'center'});focused.current=true;}},[rows,focus]);
 async function respond(id,accept){
  if(busy)return;setBusy(true);setMessage('');
  try{const state=await api.respond(id,accept);setMessage(state==='expirada'?'La solicitud venció; el horario se liberó.':state==='aceptada'?'Aceptada. Pendiente de pago; todavía no está confirmada.':'Rechazada. El horario se liberó.');await refresh();}
  catch(e){setError(e.message);}finally{setBusy(false);}
 }
 if(identityLoading)return <p role="status">Comprobando sesión para abrir tu cita…</p>;
 if(!profile)return <div className="rounded-2xl border border-white/10 bg-neutral-900 p-6"><p>Inicia sesión para consultar tus citas.</p>{focus&&<p className="mt-2">Volverás a esta misma cita después de iniciar sesión.</p>}<button className="mt-3 rounded-xl bg-amber-400 px-4 py-2 font-bold text-black" onClick={onLogin}>Iniciar sesión</button></div>;
 if(!['cliente','barbero'].includes(profile.rol))return <p role="alert">Esta cita requiere la cuenta de cliente o barbero que recibió el aviso. Este enlace no abre Administración.</p>;
 const elapsed=anchor?Math.max(0,now-anchor.received):0;
 return <section className="rounded-2xl border border-white/10 bg-neutral-900 p-6">
  <div><h2 className="text-xl font-bold">{focus?'Detalle de cita':profile.rol==='barbero'?'Solicitudes y citas de mi barbería':'Mis citas'}</h2></div>
  {focus&&<button className="mt-3 text-amber-300 underline" onClick={()=>{const url=new URL(window.location.href);url.searchParams.delete('cita');window.history.replaceState(null,'',url.pathname+url.search+url.hash);setFocus(null);}}>Ver todas mis citas</button>}
  {profile.rol==='barbero'&&<p className="mt-4">Solicitudes pendientes: {visibleRows.filter(r=>r.estado==='solicitada').length} · Pendientes de pago: {visibleRows.filter(r=>r.estado==='aceptada').length}</p>}
  {error&&<p role="alert" className="mt-3 text-red-300">{error}</p>}{message&&<p role="status" className="mt-3 text-amber-300">{message}</p>}
  {focus&&anchor&&!loading&&!error&&!rows.some(r=>r.id===focus)&&<p role="alert" className="mt-3 text-amber-300">Esta cita no está disponible para esta cuenta. Revisa que uses el mismo correo que recibió el aviso.</p>}
  {!loading&&!error&&!focus&&!visibleRows.length&&<p className="mt-3 text-neutral-400">Todavía no hay citas.</p>}
  <div className="mt-4 space-y-3">{visibleRows.map(row=>{
   const seconds=remainingSeconds(bookingDeadline(row),anchor?.serverMs,elapsed);
   return <article id={'cita-'+row.id} key={row.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
    <p className="font-bold">{row.barberias?.nombre} · {row.servicio_nombre}</p>
    <p>{row.barbero_nombre?'Barbero: '+row.barbero_nombre:'Cita histórica sin asignación individual'}</p><p>{new Date(row.inicio).toLocaleString('es-PE',{timeZone:'America/Lima'})}</p>
    <p role="status" className="text-amber-300">{bookingLabel(row)}</p>
    {['solicitada','aceptada'].includes(row.estado)&&seconds===0&&<p role="status">El plazo terminó. Actualizando el estado de tu cita.</p>}
    <p>Total S/ {row.precio_total} · Adelanto del 50 %: S/ {row.monto_adelanto}</p>
    {row.pedido_especial&&<p>Pedido especial: {row.pedido_especial}</p>}
    {profile.rol==='barbero'&&<p>Cliente: {row.cliente_nombre} · {row.cliente_telefono}</p>}
    {['solicitada','aceptada'].includes(row.estado)&&seconds!==null&&<p className="mt-2 text-sm">{row.estado==='solicitada'?'Tiempo para responder':'Tiempo para pagar'}: <span role="timer">{countdown(seconds)}</span></p>}
    {profile.rol==='barbero'&&row.puede_responder===true&&row.estado==='solicitada'&&<div className="mt-3 flex gap-2"><button disabled={busy||seconds===0} className="rounded-xl bg-amber-400 px-4 py-2 font-bold text-black disabled:opacity-40" onClick={()=>respond(row.id,true)}>Aceptar</button><button disabled={busy||seconds===0} className="rounded-xl border border-red-400 px-4 py-2 disabled:opacity-40" onClick={()=>respond(row.id,false)}>Rechazar</button></div>}
    {row.estado==='aceptada'&&<div className="mt-3 rounded-xl border border-amber-400/20 p-3"><p>{row.expira_pago_en?'Tu barbero aceptó la cita. Tienes 10 minutos para pagar el adelanto y confirmarla.':'Tu barbero aceptó esta cita previamente.'}</p>{!row.expira_pago_en&&<p>Esta cita es anterior al plazo actual de 10 minutos y no tiene vencimiento registrado. Requiere revisión de soporte.</p>}<p>Pago bloqueado: falta integrar la pasarela. No se ha cobrado ni confirmado la cita.</p>{profile.rol==='cliente'&&<button disabled className="mt-2 rounded-xl bg-neutral-700 px-4 py-2 text-neutral-400">Pagar adelanto del 50 % · S/ {row.monto_adelanto} · no disponible</button>}</div>}
    {profile.rol==='cliente'&&['rechazada','expirada'].includes(row.estado)&&<button onClick={onSearch} className="mt-3 rounded-xl bg-amber-400 px-4 py-2 font-bold text-black">Buscar otra barbería</button>}
   </article>;
  })}</div>
 </section>;
}
