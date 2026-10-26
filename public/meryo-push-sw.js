// Receives real server push with the app closed. Does not cache Auth or fake deliveries.
self.addEventListener('push',event=>{
 event.waitUntil((async()=>{
  let data={};try{data=event.data?.json()||{};}catch{/* Ignore malformed payload. */}
  const id=/^[\da-f-]{36}$/i.test(data.bookingId||'')?data.bookingId:null;
  const url=id?`/?cita=${id}#my-bookings`:'/#my-bookings';
  await self.registration.showNotification('MERYO · Tu cita',{
   body:typeof data.body==='string'?data.body.slice(0,250):'Hay una actualización en tus solicitudes.',
   tag:`meryo-${id||'reserva'}`,data:{url},silent:false,
  });
  if(data.receipt?.id&&data.receipt?.token)await fetch('/__meryo/push-ack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data.receipt)}).catch(()=>{});
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const relative=event.notification.data?.url||'/#my-bookings';
  const candidate=new URL(relative,self.location.origin);
  const target=candidate.origin===self.location.origin?candidate.href:new URL('/#my-bookings',self.location.origin).href;
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows){if(new URL(client.url).origin===self.location.origin){await client.navigate(target);return client.focus();}}
  return self.clients.openWindow(target);
 })());
});
