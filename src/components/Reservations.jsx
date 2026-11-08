import {useCallback,useEffect,useRef,useState} from 'react';
import {bookingLabel} from '../lib/meryo-api';
import {remainingSeconds,countdown} from '../lib/booking-time';
import {bookingIdFromSearch,bookingDeadline} from '../lib/booking-link';
import {visiblePolling} from '../lib/visible-polling';
import {bookingMoney,readableBookingDate,splitBookingRows} from '../lib/reservation-presentation';

export default function Reservations({api,profile,onLogin,onSearch,onRetrySession,memberId,identityLoading=false,identityError=''}){
 const [focus,setFocus]=useState(()=>typeof window!=='undefined'?bookingIdFromSearch(window.location.search):null);
 const focused=useRef(false);
 const polling=useRef(null);
 const [rows,setRows]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
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
 if(identityError)return <div role="alert" className="rounded-2xl border border-white/10 bg-neutral-900 p-6"><p>No pudimos comprobar tu sesión. Reintenta antes de iniciar sesión nuevamente.</p><button type="button" className="mt-3 rounded-xl border border-white/20 px-4 py-2" onClick={onRetrySession}>Reintentar</button></div>;
 if(!profile)return <div className="rounded-2xl border border-white/10 bg-neutral-900 p-6"><p>Inicia sesión para consultar tus citas.</p>{focus&&<p className="mt-2">Volverás a esta misma cita después de iniciar sesión.</p>}<button className="mt-3 rounded-xl bg-amber-400 px-4 py-2 font-bold text-black" onClick={onLogin}>Iniciar sesión</button></div>;
 if(!['cliente','barbero'].includes(profile.rol))return <p role="alert">Esta cita requiere la cuenta de cliente o barbero que recibió el aviso. Este enlace no abre Administración.</p>;
 const elapsed=anchor?Math.max(0,now-anchor.received):0;
 const serverNow=anchor?anchor.serverMs+elapsed:Date.now();
 const {upcoming,history}=focus?{upcoming:[],history:[]}:splitBookingRows(visibleRows,serverNow);
 const renderBooking=row=>{
  const seconds=remainingSeconds(bookingDeadline(row),anchor?.serverMs,elapsed),when=readableBookingDate(row.inicio);
  return <article id={'cita-'+row.id} key={row.id} className="meryo-booking-card">
   <h3 className="meryo-booking-business">{row.barberias?.nombre||'Negocio'}</h3>
   <dl className="meryo-booking-details">
    <div><dt>Servicio</dt><dd>{row.servicio_nombre||'Servicio'}</dd></div>
    <div><dt>Profesional</dt><dd>{row.barbero_nombre||'Profesional sin asignación registrada'}</dd></div>
    <div><dt>Fecha</dt><dd>{when.date}{when.time&&<> · {when.time}</>}</dd></div>
   </dl>
   {profile.rol==='barbero'&&row.inspiration_publication_id&&<p className="meryo-booking-note"><strong>Referencia de estilo:</strong> {row.inspiration_title_snapshot||'Trabajo seleccionado'} <span className="block break-all text-xs opacity-70">ID de publicación: {row.inspiration_publication_id}</span></p>}
   <div className="meryo-booking-status-row"><span className="meryo-booking-status" role="status">{bookingLabel(row)}</span></div>
   <dl className="meryo-booking-amounts">
    <div><dt>Total</dt><dd>{bookingMoney(row.precio_total)}</dd></div>
    <div><dt>Adelanto del 50 %</dt><dd>{bookingMoney(row.monto_adelanto)}</dd></div>
   </dl>
   {['solicitada','aceptada'].includes(row.estado)&&seconds===0&&<p role="status" className="meryo-booking-note">El plazo terminó. Actualizando el estado de tu cita.</p>}
   {row.pedido_especial&&<p className="meryo-booking-note">Pedido especial: {row.pedido_especial}</p>}
   {profile.rol==='barbero'&&<p className="meryo-booking-note">Cliente: {row.cliente_nombre} · {row.cliente_telefono}</p>}
   {['solicitada','aceptada'].includes(row.estado)&&seconds!==null&&<p className="meryo-booking-timer">{row.estado==='solicitada'?'Tiempo para responder':'Tiempo para pagar'}: <span role="timer">{countdown(seconds)}</span></p>}
   {profile.rol==='barbero'&&row.puede_responder===true&&row.estado==='solicitada'&&<div className="meryo-booking-actions"><button disabled={busy||seconds===0} className="rounded-xl bg-amber-400 px-4 py-3 font-bold text-black disabled:opacity-40" onClick={()=>respond(row.id,true)}>Aceptar</button><button disabled={busy||seconds===0} className="rounded-xl border border-red-400 px-4 py-3 disabled:opacity-40" onClick={()=>respond(row.id,false)}>Rechazar</button></div>}
   {row.estado==='aceptada'&&<div className="meryo-booking-payment"><p>{row.expira_pago_en?'El profesional aceptó la cita. Tienes 10 minutos para pagar el adelanto y confirmarla.':'El profesional aceptó esta cita previamente.'}</p>{!row.expira_pago_en&&<p>Esta cita es anterior al plazo actual de 10 minutos y no tiene vencimiento registrado. Requiere revisión de soporte.</p>}<p>Pago bloqueado: falta integrar la pasarela. No se ha cobrado ni confirmado la cita.</p>{profile.rol==='cliente'&&<button disabled className="mt-2 rounded-xl bg-neutral-700 px-4 py-3 text-neutral-400">Pagar adelanto del 50 % · {bookingMoney(row.monto_adelanto)} · no disponible</button>}</div>}
   {profile.rol==='cliente'&&['rechazada','expirada'].includes(row.estado)&&<div className="meryo-booking-actions"><button onClick={onSearch} className="rounded-xl bg-amber-400 px-4 py-3 font-bold text-black">Buscar otro negocio</button></div>}
  </article>;
 };
 const renderGroup=(title,items,emptyText)=> <section className="meryo-booking-group" aria-label={title}><h3>{title}</h3>{items.length?<div className="meryo-booking-list">{items.map(renderBooking)}</div>:<p className="meryo-booking-empty">{emptyText}</p>}</section>;
 return <section className="meryo-reservations">
  <div className="meryo-reservations-heading"><h2>{focus?'Detalle de cita':profile.rol==='barbero'?'Solicitudes y citas de mi negocio':'Mis citas'}</h2>{focus&&<button className="underline underline-offset-4" onClick={()=>{const url=new URL(window.location.href);url.searchParams.delete('cita');window.history.replaceState(null,'',url.pathname+url.search+url.hash);setFocus(null);}}>Ver todas mis citas</button>}</div>
  {profile.rol==='barbero'&&<p className="meryo-booking-summary">Solicitudes pendientes: {visibleRows.filter(r=>r.estado==='solicitada').length} · Pendientes de pago: {visibleRows.filter(r=>r.estado==='aceptada').length}</p>}
  {error&&<p role="alert" className="mt-3 text-red-300">{error}</p>}{message&&<p role="status" className="mt-3 text-amber-300">{message}</p>}
  {focus&&anchor&&!loading&&!error&&!rows.some(r=>r.id===focus)&&<p role="alert" className="mt-3 text-amber-300">Esta cita no está disponible para esta cuenta. Revisa que uses el mismo correo que recibió el aviso.</p>}
  {loading&&!visibleRows.length&&<p role="status" className="meryo-booking-empty">Cargando citas…</p>}
  {!loading&&!error&&focus&&visibleRows.length>0&&<div className="meryo-booking-list">{visibleRows.map(renderBooking)}</div>}
  {!loading&&!error&&!focus&&visibleRows.length===0&&<p className="meryo-booking-empty">Todavía no tienes citas.</p>}
  {!loading&&!error&&!focus&&visibleRows.length>0&&<>{renderGroup('Próximas',upcoming,'No tienes citas próximas.')}{renderGroup('Historial',history,'Tu historial aparecerá aquí.')}</>}
 </section>;
}
