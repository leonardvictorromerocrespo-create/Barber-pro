import {useCallback,useEffect,useRef,useState} from 'react';
import {visiblePolling} from '../lib/visible-polling';
import './ReservationChat.css';

export default function ReservationChat({api,reservation,profile,openOnMount=false}){
 const [open,setOpen]=useState(openOnMount),[messages,setMessages]=useState([]),[draft,setDraft]=useState(''),[loading,setLoading]=useState(false),[sending,setSending]=useState(false),[error,setError]=useState('');
 const active=useRef(false),polling=useRef(null);
 const load=useCallback(async()=>{
  if(!active.current)return;
  setLoading(true);
  try{
   const rows=await api.reservationChat(reservation.id);
   if(active.current){setMessages(rows);setError('');}
  }catch(e){if(active.current)setError(e.message||'No se pudo cargar el chat.');}
  finally{if(active.current)setLoading(false);}
 },[api,reservation.id]);
 useEffect(()=>{
  if(!open)return undefined;
  active.current=true;
  const reader=visiblePolling(load,{intervalMs:15000});polling.current=reader;
  return()=>{active.current=false;reader.stop();if(polling.current===reader)polling.current=null;};
 },[open,load]);
 async function submit(event){
  event.preventDefault();
  const content=draft.trim();
  if(!content||sending)return;
  setSending(true);setError('');
  try{
   const saved=await api.sendReservationMessage(reservation.id,content);
   setMessages(current=>[...current,saved].slice(-100));setDraft('');
   void polling.current?.refresh();
  }catch(e){setError(e.message||'No se pudo enviar el mensaje.');}
  finally{setSending(false);}
 }
 const counterpart=profile.rol==='cliente'?'Profesional':'Cliente';
 return <section className="meryo-reservation-chat" aria-label="Chat de la cita">
  <button type="button" className="meryo-reservation-chat__toggle" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>
   <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M4.5 5.75h15v10.5h-8l-4.75 3v-3H4.5V5.75Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M8 9.5h8M8 12.5h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
   <span>{open?'Cerrar chat':'Chat de la cita'}</span>
  </button>
  {open&&<div className="meryo-reservation-chat__panel">
   <div className="meryo-reservation-chat__heading"><h4>Conversación de la reserva</h4><p>Solo tú y el {counterpart.toLowerCase()} asignado pueden leerla.</p></div>
   {error&&<p className="meryo-reservation-chat__error" role="alert">{error}<button type="button" onClick={()=>void polling.current?.refresh()}>Reintentar</button></p>}
   <div className="meryo-reservation-chat__messages" aria-label="Mensajes" aria-live="polite" aria-busy={loading}>
    {loading&&!messages.length&&<p role="status" className="meryo-reservation-chat__empty">Cargando mensajes…</p>}
    {!loading&&!messages.length&&!error&&<p className="meryo-reservation-chat__empty">Aún no hay mensajes. Puedes coordinar los detalles de la cita aquí.</p>}
    {messages.map(message=>{
     const mine=message.autor_id===profile.id;
     return <article key={message.id} className={`meryo-reservation-chat__message${mine?' is-mine':''}`}>
      <p className="meryo-reservation-chat__author">{mine?'Tú':counterpart}</p>
      <p className="meryo-reservation-chat__body">{message.contenido}</p>
      <time dateTime={message.creado_en}>{new Date(message.creado_en).toLocaleString('es-PE',{dateStyle:'short',timeStyle:'short'})}</time>
     </article>;
    })}
   </div>
   <form className="meryo-reservation-chat__form" onSubmit={submit}>
    <label htmlFor={`mensaje-cita-${reservation.id}`}>Mensaje</label>
    <textarea id={`mensaje-cita-${reservation.id}`} value={draft} onChange={event=>setDraft(event.target.value)} maxLength={4000} rows={2} placeholder="Escribe un mensaje" disabled={sending}/>
    <div className="meryo-reservation-chat__form-footer"><span>{Array.from(draft).length}/2000</span><button type="submit" disabled={sending||!draft.trim()||Array.from(draft.trim()).length>2000}>{sending?'Enviando…':'Enviar'}</button></div>
   </form>
  </div>}
 </section>;
}
