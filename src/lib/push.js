// Called only from an explicit user gesture, after a sender is configured.
export async function enableBookingPush(api,config){
 if(!config?.push_disponible||!config.push_public_key)throw Error('Push pendiente: faltan VAPID/proveedor y un emisor de servidor.');
 if(!('serviceWorker' in navigator)||!('PushManager' in window))throw Error('Este navegador no admite push.');
 const permission=await Notification.requestPermission();
 if(permission!=='granted')throw Error('No se autorizaron las notificaciones.');
 const worker=await navigator.serviceWorker.register('/meryo-push-sw.js');
 await navigator.serviceWorker.ready;
 const key=Uint8Array.from(atob(config.push_public_key.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
 const subscription=await worker.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
 await api.registerPush(subscription.toJSON());
 return 'Dispositivo registrado. La recepción debe verificarse en este teléfono.';
}
