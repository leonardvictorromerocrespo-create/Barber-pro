import {useCallback,useEffect,useRef,useState} from 'react';
import {fechaLima,sumarDias} from '../../lib/dates.js';
import {limaInputInstant} from '../../lib/lima-time-input.js';
import {remainingSeconds,countdown} from '../../lib/booking-time.js';
import {noShowEligibility,showArrivalControl,showFinishControl} from '../../lib/no-show.js';
import {visiblePolling} from '../../lib/visible-polling.js';
import {bookingMoney,readableBookingDate} from '../../lib/reservation-presentation.js';
import {availableAgendaStarts,dayAgenda,EXTERNAL_PREFIX,limaHour,overlaps} from '../../lib/day-agenda.js';
import './TodayAgenda.css';

const labels={solicitada:'Por responder',aceptada:'Espera adelanto',confirmada:'Confirmada',completada:'Atendida',rechazada:'Rechazada',expirada:'Vencida',cancelada:'Cancelada',no_asistio:'No asistió'};
const weekDay=new Intl.DateTimeFormat('es-PE',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'});
const asDay=value=>weekDay.format(new Date(value+'T12:00:00Z'));
const paths={
 spark:'M12 2v20M2 12h20M5 5l14 14M19 5 5 19',plus:'M12 5v14M5 12h14',
 lock:'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z',
 refresh:'M20 7v5h-5M20 12a8 8 0 1 0-2 5',
 arrow:'M5 12h14m-6-6 6 6-6 6',close:'m6 6 12 12M18 6 6 18',
 calendar:'M4 6h16v15H4zM4 10h16M8 3v6m8-6v6',
};
function Icon({name}){return <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;}

function HoldDialog({mode,day,member,defaults,busy,error,onClose,onSave}){
 const ref=useRef(null);
 useEffect(()=>{
  const dialog=ref.current;
  dialog.showModal();
  return()=>dialog.close();
 },[]);
 return <dialog ref={ref} className="today-dialog" aria-labelledby="today-dialog-title" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
  <form onSubmit={event=>{event.preventDefault();void onSave(new FormData(event.currentTarget));}}>
   <header className="today-dialog__head"><div><p className="today-kicker">{member.display_name} · {asDay(day)}</p><h3 id="today-dialog-title">{mode==='external'?'Anotar cita externa':'Bloquear horario'}</h3></div><button type="button" className="today-icon-btn" aria-label="Cerrar" onClick={onClose} disabled={busy}><Icon name="close"/></button></header>
   <p className="today-muted">{mode==='external'?'Guarda un turno acordado fuera de MERYO. El horario dejará de ofrecerse en línea.':'Deja de ofrecer este tramo en línea. Las citas vigentes se respetan.'}</p>
   <div className="today-form-grid"><label>Desde<input name="start" type="time" required defaultValue={defaults.start}/></label><label>Hasta<input name="end" type="time" required defaultValue={defaults.end}/></label></div>
   {mode==='external'&&<label>Canal<select name="channel"><option>WhatsApp</option><option>En el local</option><option>Otro</option></select></label>}
   <label>{mode==='external'?'Nombre o nota (opcional)':'Motivo del bloqueo'}<input name="note" maxLength={80} minLength={mode==='block'?3:undefined} required={mode==='block'} placeholder={mode==='external'?'Ej. Luis · corte clásico':'Ej. descanso o salida'}/></label>
   {error&&<p role="alert" className="today-error">{error}</p>}
   <button type="submit" className="today-button today-button--gold" disabled={busy}>{busy?'Guardando…':mode==='external'?'Guardar cita externa':'Guardar bloqueo'}<Icon name="arrow"/></button>
  </form>
 </dialog>;
}

export default function TodayAgenda({api,team,shop,services,profile,onSaved,onAdvanced}){
 const [chosen,setChosen]=useState(()=>team.members.find(m=>m.active&&m.user_id===profile.id)?.id??team.members.find(m=>m.active)?.id);
 const [whichDay,setWhichDay]=useState(0),[serviceId,setServiceId]=useState('');
 const [snapshot,setSnapshot]=useState(null),[loadError,setLoadError]=useState(''),[time,setTime]=useState(0);
 const [slotState,setSlotState]=useState(null),[slotRevision,setSlotRevision]=useState(0);
 const [mode,setMode]=useState(null),[dialogError,setDialogError]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const reader=useRef(null),working=useRef(false);
 const member=team.members.find(m=>m.active&&m.id===chosen)??team.members.find(m=>m.active);
 const availableServices=services.filter(service=>service.activo!==false&&!service.requiere_evaluacion&&Number(service.precio)>0&&Number(service.duracion_min)>0&&member?.services?.some(id=>String(id)===String(service.id)));
 const service=availableServices.find(item=>String(item.id)===serviceId)??availableServices[0];
 const now=snapshot?snapshot.ms+Math.max(0,time-snapshot.observed):Date.parse(team.server_now);
 const today=Number.isFinite(now)?fechaLima(now):null;
 const day=today?sumarDias(today,whichDay):null;
 const agenda=day&&member?dayAgenda(snapshot?.rows??[],member.blocks??[],member.id,day,now):null;
 const occupiedKey=agenda?.occupied.map(item=>[item.id,item.estado,item.inicio??item.starts,item.fin??item.ends].join('/')).join('|')??'';
 const currentSlotKey=JSON.stringify([member?.id,service?.id,day,slotRevision,occupiedKey]);
 const slots=slotState?.key===currentSlotKey&&!loadError&&day?availableAgendaStarts(slotState.rows,day,now):null;

 const load=useCallback(async()=>{
  try{
   const response=await api.bookingState();
   const observed=performance.now(),ms=Date.parse(response.server_now);
   if(!Number.isFinite(ms))throw Error('La hora del servidor no está disponible.');
   setSnapshot({ms,observed,rows:response.reservas??[]});setTime(observed);setLoadError('');
  }catch(e){setLoadError(e.message);}
 },[api]);
 useEffect(()=>{
  const polling=visiblePolling(load);reader.current=polling;
  const clock=setInterval(()=>{if(document.visibilityState==='visible')setTime(performance.now());},1000);
  return()=>{polling.stop();reader.current=null;clearInterval(clock);};
 },[load]);
 const memberId=member?.id, chosenService=service?.id, shopId=shop.id;
 const hasSnapshot=Boolean(snapshot);
 useEffect(()=>{
  if(!hasSnapshot||!day||!memberId||!chosenService)return;
  let current=true;
  api.slots(shopId,chosenService,day,memberId).then(rows=>{if(current)setSlotState({key:currentSlotKey,rows,error:''});})
    .catch(()=>{if(current)setSlotState({key:currentSlotKey,rows:[],error:'No pudimos consultar los horarios disponibles.'});});
  return()=>{current=false;};
 },[api,day,memberId,chosenService,shopId,currentSlotKey,hasSnapshot]);

 async function refresh(reloadTeam=false){
  await Promise.all([reader.current?.refresh(),reloadTeam?onSaved():null]);
  setSlotRevision(value=>value+1);
 }
 async function act(action,message,{reloadTeam=false,inDialog=false}={}){
  if(working.current)return;
  working.current=true;setBusy(true);setError('');setDialogError('');setNotice('');
  try{
   const result=await action();
   setNotice(typeof message==='function'?message(result):message);
   if(inDialog)setMode(null);
   await refresh(reloadTeam);
  }catch(e){(inDialog?setDialogError:setError)(e.message);}
  finally{working.current=false;setBusy(false);}
 }
 const respond=(row,accept)=>act(()=>api.respond(row.id,accept),state=>state==='expirada'?'La solicitud venció.':accept?'Aceptaste la solicitud. Falta el adelanto para confirmar.':'Solicitud rechazada.');
 function startHold(kind,start=''){
  setError('');setNotice('');setDialogError('');
  const first=start?new Date(start):null;
  const end=first?new Date(first.getTime()+Number(service?.duracion_min||30)*60000):null;
  setMode({kind,start:first?limaHour(first):'',end:end&&fechaLima(end)===day?limaHour(end):'',day,memberId});
 }
 async function saveHold(form){
  if(!mode||mode.day!==day||mode.memberId!==memberId||!team.owner||loadError)return;
  try{
   const start=limaInputInstant(day+'T'+form.get('start')),end=limaInputInstant(day+'T'+form.get('end'));
   const a=Date.parse(start),b=Date.parse(end);
   if(b<=a||b<=now)throw Error('El tramo debe terminar después del inicio y en el futuro.');
   if(agenda.occupied.some(item=>overlaps(a,b,item)))throw Error('Ese tramo se cruza con una cita o un bloqueo de la agenda.');
   const note=String(form.get('note')??'').trim();
   if(mode.kind==='block'&&(note.length<3||note.startsWith(EXTERNAL_PREFIX)))throw Error('Escribe un motivo válido.');
   const reason=mode.kind==='external'?EXTERNAL_PREFIX+form.get('channel')+(note?' · '+note:''):note;
   await act(()=>api.addMemberBlock(memberId,start,end,reason),mode.kind==='external'?'Cita externa anotada. El turno queda ocupado.':'Horario bloqueado.',{reloadTeam:true,inDialog:true});
  }catch(e){setDialogError(e.message);}
 }

 if(!member)return <section className="today-agenda"><h2>Agenda de hoy</h2><p>No hay profesionales activos en el equipo.</p></section>;
 const next=agenda?.next;
 const ready=Boolean(snapshot&&agenda&&!loadError);
 const pending=agenda?.pending??[];
 const slotError=slotState?.key===currentSlotKey&&slotState.error;
 const buttonDisabled=busy||!ready;
 return <section className="today-agenda" aria-labelledby="today-title">
  <header className="today-hero">
   <div className="today-hero__meta"><span className="today-plate"><Icon name="spark"/> MERYO / AGENDA</span><button className="today-icon-btn" type="button" title="Actualizar agenda" aria-label="Actualizar agenda" disabled={busy} onClick={()=>void refresh(true)}><Icon name="refresh"/></button></div>
   <div className="today-hero__body"><div><p className="today-kicker">{day?asDay(day):'Hora de Lima'}</p><h2 id="today-title">{whichDay?'Agenda de mañana':'Agenda de hoy'}</h2><p className="today-muted">{shop.nombre} <span aria-hidden="true">/</span> {member.display_name}</p></div>
   {next&&<div className="today-next"><span>Próxima atención</span><strong>{limaHour(next.start)}</strong><p>{next.kind==='external'?'Cita externa':next.row.servicio_nombre}</p></div>}</div>
   <dl className="today-stats">
    <div><dt>Por responder</dt><dd>{ready?pending.length:'—'}</dd></div>
    <div><dt>Confirmadas</dt><dd>{ready?agenda.confirmed:'—'}</dd></div>
    <div><dt>Citas externas</dt><dd>{ready?agenda.external:'—'}</dd></div>
   </dl>
  </header>
  <div className="today-toolbar">
   <div className="today-days" role="group" aria-label="Día de la agenda">{['Hoy','Mañana'].map((label,i)=><button type="button" key={label} aria-pressed={whichDay===i} disabled={Boolean(mode)} onClick={()=>setWhichDay(i)}>{label}</button>)}</div>
   {team.owner&&<label className="today-member"><span className="sr-only">Profesional</span><select value={memberId} onChange={event=>{setChosen(event.target.value);setServiceId('');}}>{team.members.filter(item=>item.active).map(item=><option key={item.id} value={item.id}>{item.display_name}</option>)}</select></label>}
   {team.owner&&<div className="today-tools"><button className="today-button today-button--quiet" type="button" disabled={buttonDisabled} onClick={()=>startHold('block')}><Icon name="lock"/> Bloquear</button><button className="today-button today-button--gold" type="button" disabled={buttonDisabled} onClick={()=>startHold('external')}><Icon name="plus"/> Cita externa</button></div>}
  </div>
  {loadError&&<p className="today-error" role="alert">No pudimos actualizar las citas. {loadError} <button type="button" onClick={()=>void refresh()}>Reintentar</button></p>}
  {error&&<p className="today-error" role="alert">{error}</p>}
  {notice&&<p className="today-success" role="status">{notice}</p>}
  {!snapshot&&!loadError&&<p className="today-muted" role="status">Cargando agenda…</p>}
  {agenda&&<div className="today-columns">
   <div className="today-stack">
    {pending.length>0&&<section className="today-panel today-pending" aria-label="Solicitudes por responder">
     <p className="today-kicker">Requiere atención</p><h3>Solicitudes por responder</h3>
     <ul>{pending.map(row=>{
      const seconds=remainingSeconds(row.expira_respuesta_en,snapshot?.ms,snapshot?Math.max(0,time-snapshot.observed):0);
      const when=readableBookingDate(row.inicio);
      return <li key={row.id}><div className="today-rowhead"><strong>{row.cliente_nombre||'Cliente'}</strong><span className="today-timer">{seconds>0?countdown(seconds):seconds===0?'Plazo vencido':'Por responder'}</span></div><p className="today-muted">{row.servicio_nombre} · {when.date} · {when.time}</p><div className="today-rowactions"><button type="button" className="today-button today-button--gold" disabled={buttonDisabled||seconds===0} onClick={()=>void respond(row,true)}>Aceptar</button><button type="button" className="today-button today-button--quiet" disabled={buttonDisabled||seconds===0} onClick={()=>void respond(row,false)}>Rechazar</button></div></li>;
     })}</ul>
    </section>}
    <section className="today-panel" aria-label="Cronología de la agenda"><div className="today-panel__heading"><div><p className="today-kicker">En orden de atención</p><h3>Cronología</h3></div><Icon name="calendar"/></div>
     {ready&&!agenda.timeline.length&&<p className="today-empty">No tienes citas ni bloqueos para este día.</p>}
     {agenda.timeline.length>0&&<ol className="today-timeline">{agenda.timeline.map(({id,kind,row,start})=>{
      const booking=kind==='booking',canArrive=booking&&member.user_id===profile.id&&showArrivalControl(row,profile,memberId);
      const canFinish=booking&&member.user_id===profile.id&&showFinishControl(row,profile,memberId);
      const noShow=canArrive&&noShowEligibility(row,snapshot?now:null).eligible;
      return <li key={id}><time dateTime={new Date(start).toISOString()}>{limaHour(start)}</time><div className="today-event" data-kind={kind}>
       <div className="today-rowhead"><span className="today-badge" data-status={row.estado}>{booking?(row.estado==='confirmada'&&row.llegada_en?'En atención':labels[row.estado]??row.estado):kind==='external'?'Cita externa':'Bloqueado'}</span>{booking&&<span className="today-price">{bookingMoney(row.precio_total)}</span>}</div>
       <strong>{booking?row.servicio_nombre:kind==='external'?row.reason.slice(EXTERNAL_PREFIX.length):row.reason}</strong>
       <p className="today-muted">{booking?(row.cliente_nombre||'Cliente')+' · ':''}Hasta las {limaHour(row.fin??row.ends)}</p>
       {booking&&row.pedido_especial&&<p className="today-muted">{row.pedido_especial}</p>}
       {(canArrive||canFinish||(!booking&&team.owner))&&<div className="today-rowactions">
        {canArrive&&<button type="button" className="today-button today-button--quiet" disabled={buttonDisabled} onClick={()=>void act(()=>api.markArrival(row.id),'Llegada registrada.')}>Registrar llegada</button>}
        {canFinish&&<button type="button" className="today-button today-button--gold" disabled={buttonDisabled} onClick={()=>{if(window.confirm('¿Terminó el servicio y se cobró el saldo en el local? Esta acción no realiza cobros.'))void act(()=>api.finishBooking(row.id),'Cita completada.');}}>Finalizar cita</button>}
        {noShow&&<button type="button" className="today-button today-button--quiet" disabled={buttonDisabled} onClick={()=>{if(window.confirm('¿Confirmas que el cliente no asistió? No se realizará un cobro adicional.'))void act(()=>api.markNoShow(row.id),'Inasistencia registrada.');}}>No asistió</button>}
        {!booking&&team.owner&&<button type="button" className="today-button today-button--quiet" disabled={buttonDisabled} onClick={()=>{if(window.confirm('¿Liberar este horario? Podrá volver a mostrarse en línea si sigue disponible.'))void act(()=>api.removeMemberBlock(row.id),'Horario liberado.',{reloadTeam:true});}}>Liberar horario</button>}
       </div>}
      </div></li>;
     })}</ol>}
    </section>
   </div>
   <aside className="today-stack">
    <section className="today-panel today-availability" aria-label="Disponibilidad en línea"><p className="today-kicker">Lo que puede ver el cliente</p><h3>Horarios en línea</h3>
     {service?<><label className="today-service">Servicio<select value={String(service.id)} onChange={event=>setServiceId(event.target.value)}>{availableServices.map(item=><option value={String(item.id)} key={item.id}>{item.nombre}</option>)}</select></label>
       {ready&&slotError?<p className="today-error" role="alert">{slotError} <button type="button" onClick={()=>setSlotRevision(value=>value+1)}>Reintentar</button></p>:ready&&!slots?<p className="today-muted" role="status">Consultando horarios…</p>:ready&&slots?.length?<ul className="today-slots">{slots.map(slot=><li key={slot.id}>{team.owner?<button type="button" className="today-slot" disabled={buttonDisabled} onClick={()=>startHold('external',slot.time)} aria-label={'Anotar cita externa a las '+slot.label}>{slot.label}</button>:<span className="today-slot">{slot.label}</span>}</li>)}</ul>:ready?<p className="today-empty">No hay horarios en línea para este servicio.</p>:null}
       {team.owner&&<p className="today-muted">Toca una hora para anotar una cita externa.</p>}
     </>:<p className="today-empty">{team.owner?'Asigna un servicio reservable a este profesional para consultar sus horarios.':'El propietario puede consultar los horarios publicados por servicio.'}</p>}
    </section>
    <button type="button" className="today-settings" onClick={onAdvanced}>Agenda individual y ajustes <Icon name="arrow"/></button>
   </aside>
  </div>}
  {mode&&<HoldDialog mode={mode.kind} member={member} day={mode.day} defaults={mode} busy={busy} error={dialogError} onClose={()=>setMode(null)} onSave={saveHold}/>}
 </section>;
}
