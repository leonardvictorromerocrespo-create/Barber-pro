const key=id=>'meryo-push-offer-later:'+id;
export function pushOfferDeferred(storage,id){try{return Boolean(id)&&storage.getItem(key(id))==='later';}catch{return false;}}
export function deferPushOffer(storage,id){try{if(id)storage.setItem(key(id),'later');}catch{/* The component also remembers dismissal for this visit. */}}
export async function shouldOfferPush(api,device){
 if(!device||['denied','no compatible'].includes(device.permission))return false;
 if(device.permission==='granted'&&device.subscribed&&device.endpoint&&await api.pushDevice(device.endpoint))return false;
 return true;
}
