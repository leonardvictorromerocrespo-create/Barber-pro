// No Auth tokens, subscription keys or personal booking data are cached.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
async function receipt(data,kind){if(data?.id&&data?.token)await fetch('/api/push/ack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,kind})}).catch(()=>{});}
async function alreadyShown(id){if(!id||!self.caches)return false;const cache=await self.caches.open('meryo-push-seen-v1');return Boolean(await cache.match('/__push_seen/'+id));}
async function rememberShown(id){if(!id||!self.caches)return;const cache=await self.caches.open('meryo-push-seen-v1');await cache.put('/__push_seen/'+id,new Response(String(Date.now())));const keys=await cache.keys();for(const key of keys.slice(0,Math.max(0,keys.length-200)))await cache.delete(key);}
self.addEventListener('push',event=>event.waitUntil((async()=>{
 let data={};try{data=event.data?.json()||{};}catch{}
 const id=/^[\da-f-]{36}$/i.test(data.bookingId||'')?data.bookingId:null;
 const notification=/^\d+$/.test(String(data.notificationId||''))?data.notificationId:null;
 const url=id?`/?cita=${id}#my-bookings`:data.event==='push_diagnostico'?`/?admin_view=avisos${notification?'&aviso='+notification:''}#admin`:notification?`/?aviso=${notification}#notifications`:'/#notifications';
 const delivery=/^[\da-f-]{36}$/i.test(data.receipt?.id||'')?data.receipt.id:null;
 if(!await alreadyShown(delivery).catch(()=>false)){
  await self.registration.showNotification(typeof data.title==='string'?data.title.slice(0,70):'MERYO · Tu cita',{
   body:typeof data.body==='string'?data.body.slice(0,250):'Hay una actualización en tus solicitudes.',
   tag:`meryo-${id||notification||'reserva'}`,data:{url,receipt:data.receipt},silent:false,vibrate:[150,100,150],renotify:true,
  });await rememberShown(delivery).catch(()=>{});
 }
 await receipt(data.receipt,'received');
})()));
self.addEventListener('notificationclick',event=>event.waitUntil((async()=>{
 event.notification.close();await receipt(event.notification.data?.receipt,'clicked');
 const candidate=new URL(event.notification.data?.url||'/#notifications',self.location.origin);
 const target=candidate.origin===self.location.origin?candidate.href:new URL('/#notifications',self.location.origin).href;
 const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 for(const client of windows)if(new URL(client.url).origin===self.location.origin){await client.navigate(target);return client.focus();}
 return self.clients.openWindow(target);
})()));
