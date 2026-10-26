import {useCallback,useEffect,useRef,useState} from 'react';
import {bookingLabel} from '../lib/meryo-api';
import {remainingSeconds,countdown} from '../lib/booking-time';
import {enableBookingPush} from '../lib/push';

export default function Reservations({api,profile,onLogin,onSearch}){
 const focus=typeof window!=='undefined'&&window.location.hash==='#my-bookings'?new URLSearchParams(window.location.search).get('cita'):null;
 const focused=useRef(false);
 const [rows,setRows]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [anchor,setAnchor]=useState(null),[now,setNow]=useState(0),[config,setConfig]=useState(null);
 const load=useCallback(async()=>{
  setLoading(true);
  try{const data=await api.bookingState();setRows(data.reservas);setAnchor({serverMs:Date.parse(data.server_now),received:performance.now()});setNow(performance.now());setError('');}
  catch(e){setError(e.message);}finally{setLoading(false);}
 },[api]);
 useEffect(()=>{
  if(!profile||!['cliente','barbero'].includes(profile.rol))return;
  load();api.bookingConfig().then(setConfig).catch(e=>setError(e.message));
  const poll=setInterval(load,3000),clock=setInterval(()=>setNow(performance.now()),1000);
  return()=>{clearInterval(poll);clearInterval(clock);};
 },[load,api,profile]);
 useEffect(()=>{if(focus&&!focused.current&&rows.some(r=>r.id===focus)){document.getElementById('cita-'+focus)?.scrollIntoView({block:'center'});focused.current=true;}},[rows,focus]);
 async function respond(id,accept){
  if(busy)return;setBusy(true);setMessage('');
  try{const state=await api.respond(id,accept);setMessage(state==='expirada'?'La solicitud venció; el horario se liberó.':state==='aceptada'?'Aceptada. Pendiente de pago; todavía no está confirmada.':'Rechazada. El horario se liberó.');await load();}
  catch(e){setError(e.message);}finally{setBusy(false);}
 }
 if(!profile)return <div className="rounded-2xl border border-white/10 bg-neutral-900 p-6"><p>Inicia sesión para consultar tus citas.</p><button className="mt-3 rounded-xl bg-amber-400 px-4 py-2 font-bold text-black" onClick={onLogin}>Iniciar sesión</button></div>;
 if(!['cliente','barbero'].includes(profile.rol))return null;
 const elapsed=anchor?Math.max(0,now-anchor.received):0;
 return <section className="rounded-2xl border border-white/10 bg-neutral-900 p-6">
  <div className="flex justify-between"><h2 className="text-xl font-bold">{profile.rol==='barbero'?'Solicitudes y citas de mi barbería':'Mis citas'}</h2><button onClick={load} disabled={loading} className="rounded-xl border border-white/20 px-4 py-2">Actualizar</button></div>
  <p className="mt-3 text-sm text-neutral-400">MERYO: mensualidad por barbería, sin comisión por corte. Precios de planes propuestos; suscripciones sin cobro habilitado.</p>
  <p className="mt-2 text-sm text-amber-200">{config?.push_disponible?'Emisor push configurado. Falta verificar entrega real con la app cerrada y sonido en tu dispositivo.':'Push pendiente: falta configurar VAPID/contacto del emisor. La entrega con app cerrada y el sonido no están verificados.'}</p>
  <button disabled={!config?.push_disponible||busy} onClick={async()=>{try{setMessage(await enableBookingPush(api,config));}catch(e){setError(e.message);}}} className="mt-2 rounded-xl border border-white/20 px-4 py-2 disabled:opacity-40">Activar avisos al celular</button>
  {profile.rol==='barbero'&&<p className="mt-4">Solicitudes pendientes: {rows.filter(r=>r.estado==='solicitada').length} · Pendientes de pago: {rows.filter(r=>r.estado==='aceptada').length}</p>}
  {error&&<p role="alert" className="mt-3 text-red-300">{error}</p>}{message&&<p role="status" className="mt-3 text-amber-300">{message}</p>}
  {!loading&&!error&&!rows.length&&<p className="mt-3 text-neutral-400">Todavía no hay citas.</p>}
  <div className="mt-4 space-y-3">{rows.map(row=>{
   const seconds=remainingSeconds(row.expira_respuesta_en??row.expira_pago_en,anchor?.serverMs,elapsed);
   return <article id={'cita-'+row.id} key={row.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
    <p className="font-bold">{row.barberias?.nombre} · {row.servicio_nombre}</p>
    <p>{new Date(row.inicio).toLocaleString('es-PE',{timeZone:'America/Lima'})}</p>
    <p role="status" className="text-amber-300">{bookingLabel(row)}</p>
    <p>Total S/ {row.precio_total} · Adelanto del 50 %: S/ {row.monto_adelanto}</p>
    {row.pedido_especial&&<p>Pedido especial: {row.pedido_especial}</p>}
    {profile.rol==='barbero'&&<p>Cliente: {row.cliente_nombre} · {row.cliente_telefono}</p>}
    {['solicitada','aceptada'].includes(row.estado)&&seconds!==null&&<p className="mt-2 text-sm">{row.estado==='solicitada'?'Tiempo para responder':'Tiempo para pagar'}: <span role="timer">{countdown(seconds)}</span> · vencimiento del servidor</p>}
    {profile.rol==='barbero'&&row.estado==='solicitada'&&<div className="mt-3 flex gap-2"><button disabled={busy||seconds===0} className="rounded-xl bg-amber-400 px-4 py-2 font-bold text-black disabled:opacity-40" onClick={()=>respond(row.id,true)}>Aceptar</button><button disabled={busy||seconds===0} className="rounded-xl border border-red-400 px-4 py-2 disabled:opacity-40" onClick={()=>respond(row.id,false)}>Rechazar</button></div>}
    {row.estado==='aceptada'&&<div className="mt-3 rounded-xl border border-amber-400/20 p-3"><p>{row.expira_pago_en?'Tu barbero aceptó la cita. Tienes 10 minutos para pagar el adelanto y confirmarla.':'Tu barbero aceptó esta cita previamente.'}</p>{!row.expira_pago_en&&<p>Esta cita es anterior al plazo actual de 10 minutos y no tiene vencimiento registrado. Requiere revisión de soporte.</p>}<p>Pago bloqueado: falta integrar la pasarela. No se ha cobrado ni confirmado la cita.</p>{profile.rol==='cliente'&&<button disabled className="mt-2 rounded-xl bg-neutral-700 px-4 py-2 text-neutral-400">Pagar adelanto · no disponible</button>}</div>}
    {profile.rol==='cliente'&&['rechazada','expirada'].includes(row.estado)&&<button onClick={onSearch} className="mt-3 rounded-xl bg-amber-400 px-4 py-2 font-bold text-black">Buscar otra barbería</button>}
   </article>;
  })}</div>
 </section>;
}
