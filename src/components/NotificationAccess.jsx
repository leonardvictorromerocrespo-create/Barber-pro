import {useEffect,useRef,useState} from 'react';
import {enableBookingPush,pushDeviceState} from '../lib/push';
import {pushOfferDeferred,deferPushOffer,shouldOfferPush} from '../lib/push-offer';
import {visiblePolling} from '../lib/visible-polling';
import {createNotificationChime} from '../lib/notification-sound';
import './NotificationAccess.css';

const storage=()=>{try{return window.localStorage;}catch{return null;}};
const dismissedKey=id=>`meryo.dismissed-booking-notices.v1:${id}`;
function dismissedNoticeIds(id){
 try{const value=JSON.parse(storage()?.getItem(dismissedKey(id))||'[]');return new Set(Array.isArray(value)?value.map(String):[]);}catch{return new Set();}
}

export function NotificationBell(){return <a href="/#notifications" aria-label="Notificaciones" title="Notificaciones" className="inline-flex items-center justify-center rounded-xl border border-white/20 p-2 text-amber-300"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg></a>;}

export function NotificationOffer({busy=false,top=72,onAccept,onReject}){
 return <aside className="meryo-notification-offer" style={{top}} aria-labelledby="meryo-notification-offer-title">
  <h2 id="meryo-notification-offer-title">Activar notificaciones</h2>
  <div className="meryo-notification-offer__actions">
   <button type="button" disabled={busy} onClick={onAccept}>Aceptar</button>
   <button type="button" disabled={busy} onClick={onReject}>Rechazar</button>
  </div>
 </aside>;
}

export function NotificationBlocked({top=72}){
 return <aside className="meryo-notification-blocked" style={{top}} role="status">Notificaciones bloqueadas. <a href="/#notifications">Cómo habilitarlas</a></aside>;
}

export function OwnerBookingNotice({notice,onDismiss}){
 if(!notice)return null;
 return <aside className="meryo-owner-booking-notice" role="status" aria-live="polite" aria-atomic="true">
  <div className="meryo-owner-booking-notice__heading"><strong>{notice.titulo||'Nueva solicitud de cita'}</strong><button type="button" aria-label="Cerrar aviso" onClick={onDismiss}>×</button></div>
  <p>{notice.mensaje}</p>
  {notice.reserva_id&&<a href={`/?cita=${encodeURIComponent(notice.reserva_id)}#my-bookings`}>Abrir solicitud</a>}
 </aside>;
}

export default function NotificationAccess({api,profile,loading}){
 const [offer,setOffer]=useState(null),[dismissed,setDismissed]=useState(null),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState(null),[offerTop,setOfferTop]=useState(72),[bookingNotice,setBookingNotice]=useState(null),[requestOfferFor,setRequestOfferFor]=useState(null),[blockedHint,setBlockedHint]=useState(null),id=profile?.id;
 const shownNoticeIds=useRef(new Set());
 const chime=useRef(null);
 useEffect(()=>{
  const instance=createNotificationChime();chime.current=instance;
  return()=>{instance.dispose();chime.current=null;};
 },[]);
 useEffect(()=>{
  if(!feedback||feedback.error)return;
  const feedbackId=feedback.id;
  const timer=window.setTimeout(()=>setFeedback(current=>current?.id===feedbackId&&!current.error?null:current),3000);
  return()=>window.clearTimeout(timer);
 },[feedback]);
 useEffect(()=>{
  const onBookingSaved=event=>{
   if(profile?.rol==='cliente'&&event.detail?.userId===id){setRequestOfferFor(id);setBlockedHint(null);setDismissed(null);}
  };
  window.addEventListener('meryo-booking-request-saved',onBookingSaved);
  return()=>window.removeEventListener('meryo-booking-request-saved',onBookingSaved);
 },[id,profile?.rol]);
 useEffect(()=>{
  if(!id||loading||profile?.rol!=='cliente'||requestOfferFor!==id)return;let active=true;
  const inspect=async()=>{
   if(pushOfferDeferred(storage(),id)){if(active){setOffer(null);setBlockedHint(null);}return;}
   try{
    const device=await pushDeviceState();if(!active)return;
    if(device.permission==='denied'){setOffer(null);setBlockedHint(id);return;}
    if(!await shouldOfferPush(api,device)){if(active){setOffer(null);setBlockedHint(null);}return;}
    const config=await api.bookingConfig();if(active){setBlockedHint(null);setOffer(config.push_disponible?{id,config}:null);}
   }catch{/* Keep settings accessible without interrupting the session. */}
  };
  void inspect();window.addEventListener('meryo-push-changed',inspect);
  return()=>{active=false;window.removeEventListener('meryo-push-changed',inspect);};
 },[api,id,loading,profile?.rol,requestOfferFor]);
 const visible=offer?.id===id&&dismissed!==id;
 const blockedVisible=blockedHint===id;
 useEffect(()=>{
  if(!visible&&!blockedVisible)return undefined;
  const updateTop=()=>{
   const anchor=document.querySelector('.meryo-site-header')||document.querySelector('.meryo-notification-access-header');
   const bottom=anchor?.getBoundingClientRect().bottom||0;
   setOfferTop(Math.max(12,Math.ceil(bottom+12)));
  };
  updateTop();window.addEventListener('scroll',updateTop,{passive:true});window.addEventListener('resize',updateTop);
  const anchor=document.querySelector('.meryo-site-header')||document.querySelector('.meryo-notification-access-header');
  const observer=typeof ResizeObserver==='undefined'||!anchor?null:new ResizeObserver(updateTop);
  observer?.observe(anchor);
  return()=>{window.removeEventListener('scroll',updateTop);window.removeEventListener('resize',updateTop);observer?.disconnect();};
 },[visible,blockedVisible]);
 useEffect(()=>{
  if(!id||loading||profile?.rol!=='barbero'){setBookingNotice(null);return undefined;}
  let active=true;const openedAt=Date.now();
  const read=async()=>{
   const rows=await api.notifications(id);if(!active)return;
   const dismissedIds=dismissedNoticeIds(id),now=Date.now();
   const notice=rows.find(row=>{
    if(row.tipo!=='reserva_solicitada'||!row.reserva_id)return false;
    const noticeId=String(row.id),age=now-Date.parse(row.created_at);
    return age>=-60000&&age<=15*60*1000&&!dismissedIds.has(noticeId)&&!shownNoticeIds.current.has(noticeId);
   });
   if(notice){
    const noticeId=String(notice.id);shownNoticeIds.current.add(noticeId);setBookingNotice(notice);
    if(Date.parse(notice.created_at)>=openedAt-3000)chime.current?.play(noticeId);
   }
  };
  const reader=visiblePolling(()=>read().catch(()=>{}));
  return()=>{active=false;reader.stop();};
 },[api,id,loading,profile?.rol]);
 if(!profile||loading)return null;
 async function activate(){if(busy)return;setBusy(true);setFeedback(null);try{await enableBookingPush(api,offer.config);setOffer(null);setBlockedHint(null);setFeedback({id,text:'Notificaciones activadas.',error:false});}catch(e){if(globalThis.Notification?.permission==='denied'){setOffer(null);setBlockedHint(id);setFeedback(null);}else setFeedback({id,text:e.message,error:true});}finally{setBusy(false);}}
 function reject(){deferPushOffer(storage(),id);setDismissed(id);setOffer(null);setFeedback(null);}
 function dismissBookingNotice(){
  if(bookingNotice){const store=storage();if(store){const key=dismissedKey(id),ids=dismissedNoticeIds(id);ids.add(String(bookingNotice.id));try{store.setItem(key,JSON.stringify([...ids].slice(-50)));}catch{/* The notice still closes for this visit. */}}}
  setBookingNotice(null);
 }
 return <><header className="meryo-notification-access-header border-b border-white/10 bg-neutral-950 text-white"><div className="mx-auto max-w-7xl space-y-2 px-6 py-2"><nav aria-label="Mi cuenta y avisos" className="flex items-center justify-end gap-3"><a className="text-sm text-neutral-300" href="/#account">Mi cuenta</a><NotificationBell/></nav>{feedback?.id===id&&feedback.error&&<p role="alert" className="text-sm text-red-300">{feedback.text} <a className="underline" href="/#notifications">Mi cuenta → Notificaciones</a></p>}</div></header>{visible&&<NotificationOffer busy={busy} top={offerTop} onAccept={activate} onReject={reject}/>}{blockedVisible&&<NotificationBlocked top={offerTop}/>}<OwnerBookingNotice notice={bookingNotice} onDismiss={dismissBookingNotice}/>{feedback?.id===id&&!feedback.error&&<p role="status" className="pointer-events-none fixed bottom-4 left-3 right-3 z-50 mx-auto max-w-sm rounded-xl border border-amber-400/30 bg-neutral-900 px-4 py-3 text-center text-sm text-amber-300 shadow-xl">{feedback.text}</p>}</>;
}
