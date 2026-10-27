import {useCallback,useEffect,useRef,useState} from 'react';
import {enableBookingPush,disableBookingPush,pushDeviceState} from '../lib/push';
const button='rounded-xl border border-white/20 px-4 py-3 disabled:opacity-40';
const permissions={default:'Sin decidir',granted:'Permitidas',denied:'Bloqueadas','no compatible':'No compatible'};
const events={reserva_solicitada:'Solicitud de cita',reserva_aceptada:'Aceptación de cita',reserva_rechazada:'Solicitud rechazada',reserva_expirada:'Solicitud vencida',push_diagnostico:'Comprobación propia'};
const statuses={pending_provider:'Pendiente de envío',queued:'Pendiente de reintento',leased:'Procesando envío',accepted:'Envío aceptado por el servicio',expired:'Aviso vencido',failed:'No se pudo entregar'};
export default function PushCenter({api,profile,loading=false,onLogin,onBack,diagnostic=false,embedded=false}){
 const [config,setConfig]=useState(null),[device,setDevice]=useState(null),[synced,setSynced]=useState(null),[notes,setNotes]=useState([]),[evidence,setEvidence]=useState(null),[notesOwner,setNotesOwner]=useState(null);
 const [configError,setConfigError]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const inFlight=useRef(false),acting=useRef(false),generation=useRef(0),queued=useRef(false),latestLoad=useRef(null),userId=profile?.id;
 const load=useCallback(async()=>{
  if(acting.current||document.visibilityState==='hidden')return;
  if(inFlight.current){queued.current=true;return;}
  inFlight.current=true;const version=generation.current;
  const current=()=>version===generation.current;
  // Public sender state is independent of private account/MFA requests.
  const publicState=api.bookingConfig().then(c=>{setConfig(c);setConfigError('');}).catch(e=>{setConfigError(e.message);});
  try{
   const local=await pushDeviceState();if(current())setDevice(local);
   if(userId){
    const [_saved,n,registered,admin]=await Promise.all([api.pushState(),api.notifications(userId),local.endpoint?api.pushDevice(local.endpoint):Promise.resolve(false),diagnostic?api.pushAdminState():Promise.resolve(null)]);
    if(current()){setSynced(Boolean(registered));setNotes(n);setEvidence(admin);setNotesOwner(userId);setError('');}
   }else if(current()){setSynced(null);setNotes([]);setEvidence(null);setNotesOwner(null);}
  }catch(e){if(current())setError(e.message);}finally{await publicState;inFlight.current=false;if(queued.current){queued.current=false;setTimeout(()=>latestLoad.current?.(),0);}}
 },[api,userId,diagnostic]);
 useEffect(()=>{latestLoad.current=load;generation.current++;load();const timer=setInterval(load,15000);window.addEventListener('focus',load);return()=>{latestLoad.current=null;generation.current++;clearInterval(timer);window.removeEventListener('focus',load);};},[load]);
 async function act(action){acting.current=true;setBusy(true);setError('');setMessage('');try{setMessage(await action());}catch(e){setError(e.message);}finally{acting.current=false;setBusy(false);await load();}}
 const visibleNotes=notesOwner===userId?notes.filter(n=>diagnostic||n.tipo!=='push_diagnostico'):[],linked=notesOwner===userId?synced:null,adminEvidence=notesOwner===userId?evidence:null;
 const Wrapper=embedded?'section':'main';
 return <Wrapper className={embedded?'space-y-5':'min-h-screen bg-neutral-950 p-6 text-white'}><div className="mx-auto max-w-3xl space-y-5">
  <h1 className="text-3xl font-black">{diagnostic?'Diagnóstico de avisos':'Notificaciones'} <span className="text-amber-400">MERYO</span></h1>
  {!embedded&&<button className={button} onClick={onBack}>Volver</button>}
  <section className="space-y-4 rounded-2xl border border-white/10 bg-neutral-900 p-6">
   <h2 className="text-xl font-bold">Avisos en este dispositivo</h2>
   <p>Permiso: {permissions[device?.permission]||'consultando'} · {linked===null?'Consultando vinculación…':linked?'Dispositivo vinculado a tu cuenta':'Dispositivo sin vincular'}</p>
   <p className="text-sm text-neutral-400">Recibe novedades de tus citas aunque MERYO esté cerrada. El sonido depende de los ajustes del celular, Chrome y No molestar.</p>
   {!profile?(loading?<p role="status">Comprobando sesión…</p>:<button className={button} onClick={onLogin}>Continuar con Google o iniciar sesión</button>):<>
    <div className="flex flex-wrap gap-3"><button disabled={busy||!config?.push_disponible||device?.permission==='denied'} className="rounded-xl bg-amber-400 px-4 py-3 font-bold text-black disabled:opacity-40" onClick={()=>act(()=>enableBookingPush(api,config))}>Activar notificaciones</button>
    <button disabled={busy||!device?.subscribed} className={button} onClick={()=>act(async()=>{await disableBookingPush(api);return 'Avisos desactivados en este dispositivo.';})}>Desactivar en este dispositivo</button></div>
    {device?.permission==='denied'&&<p className="text-amber-300">Chrome bloqueó el permiso. Abre la información del sitio → Permisos → Notificaciones y permítelas; después vuelve aquí.</p>}
    {config?.push_disponible===false&&<p className="text-amber-300">El emisor del servidor está temporalmente desactivado.</p>}
    {!config&&!configError&&<p role="status">Consultando disponibilidad de avisos…</p>}
   </>}
   {configError&&<p role="alert" className="text-amber-300">No se pudo comprobar la disponibilidad del emisor. {configError}</p>}
   {error&&<p role="alert" className="text-red-300">{error}</p>}{message&&<p role="status" className="text-amber-300">{message}</p>}
   <button disabled={busy} className={button} onClick={load}>Actualizar permisos</button>
  </section>
  {diagnostic&&profile&&<section className="space-y-4 rounded-2xl border border-white/10 bg-neutral-900 p-6"><h2 className="text-xl font-bold">Comprobación administrativa</h2>
   <p className="text-sm text-neutral-400">Solo administración con MFA. Esta comprobación avisa a los dispositivos vinculados a tu propia cuenta y no crea reservas ni cobros.</p>
   <button disabled={busy||!(adminEvidence?.dispositivos>0)||!config?.push_disponible} className={button} onClick={()=>act(async()=>{await api.testPush();return 'Comprobación programada. Cierra todas las pestañas MERYO de este celular y bloquea la pantalla. Espera hasta dos minutos sin forzar la detención de Chrome. Después toca el aviso.';})}>Probar push con MERYO cerrada</button>
   <p className="text-sm text-neutral-400">Demora del servidor: al menos 30 segundos. Un envío aceptado no demuestra recepción. La recepción con la aplicación cerrada y el sonido se comprueban en el teléfono.</p>
   {adminEvidence?.ultimos?.map(j=><div key={j.id} className="border-t border-white/10 pt-3 text-sm"><p>{events[j.evento]||'Actualización de cita'} · {statuses[j.estado]||'Consultando'}</p><p>Servicio: {j.provider_accepted_at?'aceptó':'pendiente'} · Dispositivo: {j.recibida_en?'reportó mostrada':'sin acuse'} · Apertura: {j.abierta_en?'reportada':'sin acuse'}</p></div>)}
  </section>}
  {profile&&<section className="rounded-2xl border border-white/10 bg-neutral-900 p-6"><h2 className="text-xl font-bold">Avisos guardados</h2>
   {!visibleNotes.length&&<p className="mt-3 text-neutral-400">Todavía no tienes avisos.</p>}
   {visibleNotes.map(n=><article key={n.id} className="mt-3 border-t border-white/10 pt-3"><p className="font-bold">{n.titulo}</p><p className="mt-2 text-sm">{n.mensaje}</p>{n.reserva_id&&<a className="mt-2 inline-block text-amber-300 underline" href={`/?cita=${n.reserva_id}#my-bookings`}>Abrir cita</a>}</article>)}
  </section>}
 </div></Wrapper>;
}
