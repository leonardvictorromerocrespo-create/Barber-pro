const KEY='meryo-booking-draft-v1',TTL=30*60*1000;
export function saveDraft(storage,draft,now=Date.now()){
 const clean={shop:String(draft.shop),service:String(draft.service),barber:/^[0-9a-f-]{36}$/i.test(draft.barber||'')?draft.barber:'',date:String(draft.date),time:String(draft.time||''),name:String(draft.name||'').slice(0,80),phone:String(draft.phone||'').slice(0,20),note:String(draft.note||'').slice(0,300),savedAt:now};
 if(!/^\d+$/.test(clean.shop)||!/^\d+$/.test(clean.service)||!/^\d{4}-\d{2}-\d{2}$/.test(clean.date))throw Error('Reserva incompleta');
 storage.setItem(KEY,JSON.stringify(clean));return clean;
}
export function readDraft(storage,now=Date.now()){
 try{const d=JSON.parse(storage.getItem(KEY));if(!d||!Number.isFinite(d.savedAt)||now-d.savedAt>TTL||d.savedAt>now||!/^\d+$/.test(d.shop)||!/^\d+$/.test(d.service)||!/^\d{4}-\d{2}-\d{2}$/.test(d.date))return clearDraft(storage);return {shop:String(d.shop),service:String(d.service),barber:/^[0-9a-f-]{36}$/i.test(d.barber||'')?d.barber:'',date:d.date,time:String(d.time||''),name:String(d.name||'').slice(0,80),phone:String(d.phone||'').slice(0,20),note:String(d.note||'').slice(0,300),savedAt:d.savedAt};}catch{return clearDraft(storage);}
}
export function clearDraft(storage){storage.removeItem(KEY);return null;}
export async function beginGoogle(client,{enabled,origin}){
 if(!enabled)throw Error('Google está pendiente de configurar en Supabase Auth. Puedes continuar con correo y contraseña.');
 const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:`${origin}/?auth_callback=1`,scopes:'openid email profile',queryParams:{prompt:'select_account'}}});
 if(error)throw error;
}
