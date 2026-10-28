import {useEffect,useState} from 'react';
import {enableBookingPush,pushDeviceState} from '../lib/push';
import {pushOfferDeferred,deferPushOffer,shouldOfferPush} from '../lib/push-offer';
const storage=()=>{try{return window.localStorage;}catch{return null;}};
export function NotificationBell(){return <a href="/#notifications" aria-label="Notificaciones" title="Notificaciones" className="inline-flex items-center justify-center rounded-xl border border-white/20 p-2 text-amber-300"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg></a>;}
export default function NotificationAccess({api,profile,loading}){
 const [offer,setOffer]=useState(null),[dismissed,setDismissed]=useState(null),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState(null),id=profile?.id;
 useEffect(()=>{
  if(!id||loading)return;let active=true;
  const inspect=async()=>{if(pushOfferDeferred(storage(),id))return;
   try{const device=await pushDeviceState();if(!await shouldOfferPush(api,device)){if(active)setOffer(null);return;}const config=await api.bookingConfig();if(active)setOffer(config.push_disponible?{id,config}:null);}catch{/* Do not interrupt access or infer a disabled sender; settings remain available. */}
  };
  inspect();window.addEventListener('meryo-push-changed',inspect);
  return()=>{active=false;window.removeEventListener('meryo-push-changed',inspect);};
 },[api,id,loading]);
 if(!profile||loading)return null;
 const visible=offer?.id===id&&dismissed!==id;
 async function activate(){if(busy)return;setBusy(true);setFeedback(null);try{await enableBookingPush(api,offer.config);setOffer(null);setFeedback({id,text:'Notificaciones activadas.',error:false});}catch(e){if(globalThis.Notification?.permission==='denied')setOffer(null);setFeedback({id,text:e.message,error:true});}finally{setBusy(false);}}
 function later(){deferPushOffer(storage(),id);setDismissed(id);setOffer(null);setFeedback(null);}
 return <header className="border-b border-white/10 bg-neutral-950 text-white"><div className="mx-auto max-w-7xl space-y-2 px-6 py-2"><nav aria-label="Mi cuenta y avisos" className="flex items-center justify-end gap-3"><a className="text-sm text-neutral-300" href="/#account">Mi cuenta</a><NotificationBell/></nav>{visible&&<aside className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-neutral-900 px-4 py-3 text-sm"><p>Recibe avisos de tus citas, incluso con MERYO cerrada.</p><div className="flex gap-3"><button disabled={busy} onClick={activate} className="rounded-lg bg-amber-400 px-4 py-2 font-bold text-black disabled:opacity-40">{busy?'Activando…':'Activar'}</button><button disabled={busy} onClick={later} className="rounded-lg border border-white/20 px-4 py-2">Ahora no</button></div></aside>}{feedback?.id===id&&<p role={feedback.error?'alert':'status'} className={feedback.error?'text-sm text-red-300':'text-sm text-amber-300'}>{feedback.text}{feedback.error&&<> <a className="underline" href="/#notifications">Mi cuenta → Notificaciones</a></>}</p>}</div></header>;
}
