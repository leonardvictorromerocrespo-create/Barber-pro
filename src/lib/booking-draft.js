const KEY='meryo-booking-draft-v1',TTL=30*60*1000;
const uuid=value=>/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value||'');
function promotion(draft){
 const campaignId=uuid(draft.campaignId)?draft.campaignId:null;
 const regularPrice=campaignId&&Number.isFinite(Number(draft.regularPrice))&&Number(draft.regularPrice)>0?Number(draft.regularPrice):null;
 return {campaignId:regularPrice?campaignId:null,regularPrice};
}
function salonPromotion(draft){
 const salonPromotionId=uuid(draft.salonPromotionId)?draft.salonPromotionId:null;
 const salonRegularPrice=Number.isFinite(Number(draft.salonRegularPrice))&&Number(draft.salonRegularPrice)>0?Number(draft.salonRegularPrice):null;
 const salonPromoPrice=Number.isFinite(Number(draft.salonPromoPrice))&&Number(draft.salonPromoPrice)>0?Number(draft.salonPromoPrice):null;
 return {salonPromotionId:salonPromotionId&&salonRegularPrice&&salonPromoPrice?salonPromotionId:null,salonRegularPrice,salonPromoPrice:salonPromotionId?salonPromoPrice:null};
}
export function saveDraft(storage,draft,now=Date.now()){
 const finderExpectedPrice=draft.turnFinder===true&&Number.isFinite(Number(draft.finderExpectedPrice))&&Number(draft.finderExpectedPrice)>0?Number(draft.finderExpectedPrice):null;
 const clean={shop:String(draft.shop),service:String(draft.service),barber:uuid(draft.barber)?draft.barber:'',category:draft.category==='belleza'?'belleza':'barberia',date:String(draft.date),time:String(draft.time||''),name:String(draft.name||'').slice(0,80),phone:String(draft.phone||'').slice(0,20),note:String(draft.note||'').slice(0,300),turnFinder:finderExpectedPrice!==null,finderExpectedPrice,...promotion(draft),...salonPromotion(draft),savedAt:now};
 if(!/^\d+$/.test(clean.shop)||!/^\d+$/.test(clean.service)||!/^\d{4}-\d{2}-\d{2}$/.test(clean.date))throw Error('Reserva incompleta');
 storage.setItem(KEY,JSON.stringify(clean));return clean;
}
export function readDraft(storage,now=Date.now()){
 try{
  const d=JSON.parse(storage.getItem(KEY));
  if(!d||!Number.isFinite(d.savedAt)||now-d.savedAt>TTL||d.savedAt>now||!/^\d+$/.test(d.shop)||!/^\d+$/.test(d.service)||!/^\d{4}-\d{2}-\d{2}$/.test(d.date))return clearDraft(storage);
  const finderExpectedPrice=d.turnFinder===true&&Number.isFinite(Number(d.finderExpectedPrice))&&Number(d.finderExpectedPrice)>0?Number(d.finderExpectedPrice):null;
  return {shop:String(d.shop),service:String(d.service),barber:uuid(d.barber)?d.barber:'',category:d.category==='belleza'?'belleza':'barberia',date:d.date,time:String(d.time||''),name:String(d.name||'').slice(0,80),phone:String(d.phone||'').slice(0,20),note:String(d.note||'').slice(0,300),turnFinder:finderExpectedPrice!==null,finderExpectedPrice,...promotion(d),...salonPromotion(d),savedAt:d.savedAt};
 }catch{return clearDraft(storage);}
}
export function clearDraft(storage){storage.removeItem(KEY);return null;}
export async function beginGoogle(client,{enabled,origin,bookingId,orderId,adminView,destination}){
 if(!enabled)throw Error('Google está pendiente de configurar en Supabase Auth. Puedes continuar con correo y contraseña.');
 const target=new URL('/?auth_callback=1',origin);if(uuid(bookingId))target.searchParams.set('cita',bookingId);
 if(!target.searchParams.has('cita')&&uuid(orderId))target.searchParams.set('pedido',orderId);
 if(target.searchParams.has('pedido')&&destination==='shop-order')target.searchParams.set('pedido_origen','negocio');
 if(!target.searchParams.has('cita')&&adminView==='avisos')target.searchParams.set('admin_view','avisos');
 if(!target.searchParams.has('cita')&&['barber','shop-register'].includes(destination))target.searchParams.set('access',destination);
 if(destination==='shop-order'&&target.searchParams.has('pedido')){target.searchParams.set('shop_view','tienda');target.searchParams.set('tienda_view','pedidos');}
 const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:target.href,scopes:'openid email profile',queryParams:{prompt:'select_account'}}});
 if(error)throw error;
}
