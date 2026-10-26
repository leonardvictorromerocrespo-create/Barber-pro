// Receives real server push with the app closed. Does not cache Auth or fake deliveries.
self.addEventListener('push',event=>{
 // Generic text avoids exposing appointment/contact details on a lock screen.
 event.waitUntil(self.registration.showNotification('MERYO · Actualización de cita',{
  body:'Hay una actualización en tus solicitudes. Abre MERYO para consultar el estado.',
  tag:'meryo-reserva',data:{url:'/#my-bookings'},silent:false,
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const target=new URL('/#my-bookings',self.location.origin).href;
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows){if(new URL(client.url).origin===self.location.origin){await client.navigate(target);return client.focus();}}
  return self.clients.openWindow(target);
 })());
});
