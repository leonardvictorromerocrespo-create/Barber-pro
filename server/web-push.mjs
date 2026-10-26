import webpush from 'web-push';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
export const digest=s=>createHash('sha256').update(s).digest('hex');
export function validatePushEndpoint(endpoint){
 const u=new URL(endpoint);
 const hosts=['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com','wns2-par02p.notify.windows.com'];
 if(u.protocol!=='https:'||u.username||u.password||u.port||!(hosts.some(h=>u.hostname===h)||/^[a-z0-9-]+\.notify\.windows\.com$/.test(u.hostname))||u.hash)throw Error('Unsupported push endpoint');
 return u.href;
}
export async function deliverBookingPush(pool,config,{send=webpush.sendNotification.bind(webpush)}={}){
 if(!config?.publicKey||!config.privateKey||!config.subject)return 'not_configured';
 webpush.setVapidDetails(config.subject,config.publicKey,config.privateKey);
 const token=randomUUID();
 const {rows}=await pool.query(`with picked as (
 select o.id from meryo_private.push_outbox o
 join public.reservas r on r.id=o.reserva_id
 join public.profiles p on p.id=o.user_id and p.activo
 where o.status in ('pending_provider','queued','leased') and o.available_at<=clock_timestamp()
 and (o.lease_until is null or o.lease_until<clock_timestamp()) and o.attempts<5
 and exists(select 1 from meryo_private.push_subscriptions s where s.user_id=o.user_id)
 and ((o.event='reserva_solicitada' and r.estado='solicitada' and r.expira_respuesta_en>clock_timestamp())
 or (o.event='reserva_aceptada' and r.estado='aceptada' and r.expira_pago_en>clock_timestamp())
 or (o.event in ('reserva_rechazada','reserva_expirada','reserva_confirmada') and o.created_at>clock_timestamp()-interval '1 day'))
 order by o.id for update of o skip locked limit 1)
 update meryo_private.push_outbox o set status='leased',lease_token=$1,lease_until=clock_timestamp()+interval '40 seconds',attempts=attempts+1
 from picked where o.id=picked.id returning o.*`,[token]);
 const job=rows[0];if(!job)return 'idle';
 const validity=(await pool.query(`select case when $2='reserva_solicitada' then extract(epoch from expira_respuesta_en-clock_timestamp()) when $2='reserva_aceptada' then extract(epoch from expira_pago_en-clock_timestamp()) else 900 end as seconds from public.reservas where id=$1`,[job.reserva_id,job.event])).rows[0];
 const ttl=Math.max(0,Math.floor(Number(validity?.seconds??0)));
 if(!ttl){await pool.query("update meryo_private.push_outbox set status='expired',lease_until=null where id=$1 and lease_token=$2",[job.id,token]);return 'expired';}
 const subscriptions=(await pool.query('select * from meryo_private.push_subscriptions where user_id=$1',[job.user_id])).rows;
 let accepted=0,failed=false;
 for(const s of subscriptions){
  const endpointHash=digest(s.endpoint),ack=randomBytes(32).toString('base64url');
  const delivery=(await pool.query(`insert into meryo_private.push_deliveries(outbox_id,endpoint_hash,ack_hash,expires_at)
   values($1,$2,$3,clock_timestamp()+interval '1 day') on conflict(outbox_id,endpoint_hash) do update
   set ack_hash=excluded.ack_hash where push_deliveries.provider_accepted_at is null returning id`,[job.id,endpointHash,digest(ack)])).rows[0];
  if(!delivery){accepted++;continue;}
  try{
   validatePushEndpoint(s.endpoint);
   await send({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify({bookingId:job.reserva_id,
    title:'MERYO · Tu cita',body:job.event==='reserva_aceptada'?'Tu barbero aceptó la cita. Tienes 10 minutos para pagar el adelanto y confirmarla.':job.event==='reserva_expirada'?'La solicitud venció y el horario fue liberado. Busca otra barbería.':'Hay una actualización en tu cita MERYO.',
    receipt:{id:delivery.id,token:ack}}),{TTL:Math.min(ttl,900),urgency:'high',timeout:7000});
   accepted++;await pool.query('update meryo_private.push_deliveries set provider_accepted_at=clock_timestamp() where id=$1',[delivery.id]);
  }catch(error){
   if([404,410].includes(error.statusCode))await pool.query('delete from meryo_private.push_subscriptions where endpoint=$1 and user_id=$2',[s.endpoint,job.user_id]);
   else failed=true;
  }
 }
 await pool.query(`update meryo_private.push_outbox set status=$3,lease_until=null,available_at=clock_timestamp()+interval '30 seconds',
 provider_accepted_at=case when $4 then clock_timestamp() else provider_accepted_at end where id=$1 and lease_token=$2`,[job.id,token,failed?(job.attempts>=5?'failed':'queued'):accepted?'accepted':'failed',accepted>0]);
 return accepted?'provider_accepted':'retry';
}
export function startPushWorker(pool,config){
 let busy=false;const timer=setInterval(async()=>{if(busy)return;busy=true;try{await deliverBookingPush(pool,config);}catch{/* No tokens/provider responses in logs. */}finally{busy=false;}},3000);
 return()=>clearInterval(timer);
}
export async function acknowledgePush(pool,{id,token}){
 if(!/^[\da-f-]{36}$/i.test(id||'')||!/^[\w-]{43}$/.test(token||''))return false;
 const result=await pool.query(`update meryo_private.push_deliveries set received_at=coalesce(received_at,clock_timestamp())
 where id=$1 and ack_hash=$2 and expires_at>clock_timestamp() returning id`,[id,digest(token)]);
 return result.rowCount===1;
}
