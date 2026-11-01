const KEY='meryo-pickup-cart-v1',TTL=60*60*1000;
function clean(cart,now){
 if(!cart||!/^\d+$/.test(String(cart.shop))||!Array.isArray(cart.items)||!cart.items.length||cart.items.length>20||!Number.isFinite(cart.savedAt)||now-cart.savedAt>TTL||cart.savedAt>now)return null;
 const items=[];
 for(const item of cart.items){if(!/^\d+$/.test(String(item?.productId))||!Number.isInteger(item?.quantity)||item.quantity<1||item.quantity>99)return null;items.push({productId:String(item.productId),quantity:item.quantity});}
 if(new Set(items.map(item=>item.productId)).size!==items.length)return null;
 return {shop:String(cart.shop),items,savedAt:cart.savedAt};
}
export function savePickupCart(storage,cart,now=Date.now()){
 const value=clean({...cart,savedAt:now},now);if(!value)throw Error('La selección de productos ya no es válida. Vuelve a elegirla.');
 storage.setItem(KEY,JSON.stringify(value));return value;
}
export function readPickupCart(storage,now=Date.now()){
 try{const value=clean(JSON.parse(storage.getItem(KEY)),now);if(!value)return clearPickupCart(storage);return value;}catch{return clearPickupCart(storage);}
}
export function clearPickupCart(storage){storage.removeItem(KEY);return null;}
