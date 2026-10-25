import { randomUUID } from 'node:crypto';

// Server-only repository. No frontend key or browser lifecycle participates.
export class NotificationQueue {
  constructor(pool){this.pool=pool;}
  async claim(){
    const lease=randomUUID();
    const {rows}=await this.pool.query(`with picked as (
      select o.id from meryo_private.notification_outbox o
      join meryo_private.notification_contacts c on c.user_id=o.user_id and c.enabled
      join public.profiles p on p.id=o.user_id and p.activo is true and p.rol='barbero'
      where (o.status='queued' or (o.status='leased' and o.lease_until<clock_timestamp()))
        and o.available_at<=clock_timestamp() and o.expires_at>clock_timestamp() and o.attempts<5
        and (o.event<>'reserva_solicitada' or exists(select 1 from public.reservas r where r.id=o.reserva_id and r.estado='solicitada'))
      order by o.available_at for update of o skip locked limit 1
    ), leased as (
      update meryo_private.notification_outbox o set status='leased',attempts=attempts+1,
        lease_token=$1,lease_until=clock_timestamp()+interval '30 seconds'
      from picked where picked.id=o.id returning o.*
    ) select l.*,c.email from leased l join meryo_private.notification_contacts c on c.user_id=l.user_id`,[lease]);
    return rows[0]??null;
  }
  async accepted(job,providerId){
    await this.pool.query(`update meryo_private.notification_outbox set status='accepted',provider_id=$3,lease_until=null
      where id=$1 and lease_token=$2 and status='leased'`,[job.id,job.lease_token,providerId]);
  }
  async failed(job,code){
    // Store bounded error categories only; never provider responses or credentials.
    await this.pool.query(`update meryo_private.notification_outbox set status=case when attempts>=5 then 'dead' else 'queued' end,
      last_error=$3,available_at=clock_timestamp()+make_interval(secs=>least(60,5*power(2,attempts)::int)),lease_until=null
      where id=$1 and lease_token=$2 and status='leased'`,[job.id,job.lease_token,code]);
  }
  async expire(){
    await this.pool.query(`update meryo_private.notification_outbox o set status='expired',lease_until=null
      where status in ('queued','leased') and (expires_at<=clock_timestamp() or
      (event='reserva_solicitada' and not exists(select 1 from public.reservas r where r.id=o.reserva_id and r.estado='solicitada')))`);
  }
}

export function resendSender({apiKey,from,appUrl,fetchImpl=fetch}){
  const origin=new URL(appUrl);
  if(origin.protocol!=='https:' || origin.username || origin.password || origin.search || origin.hash) throw Error('HTTPS application origin required');
  if(!apiKey || !from) throw Error('Verified email sender required');
  return async job=>{
    const response=await fetchImpl('https://api.resend.com/emails',{
      method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`meryo-notification/${job.id}`},
      body:JSON.stringify({from,to:[job.email],subject:job.event==='reserva_solicitada'?'MERYO: nueva solicitud':'MERYO: actualización de reserva',
        text:`Hay una actualización en tu agenda MERYO. Abre ${origin.origin} para revisarla. La solicitud solo se acepta desde tu cuenta y dentro del plazo vigente.`}),
      signal:AbortSignal.timeout(5000)
    });
    if(!response.ok) throw Error('provider_rejected');
    const body=await response.json();
    if(typeof body.id!=='string' || !body.id) throw Error('provider_response_invalid');
    return body.id; // Accepted by API is not proof of inbox delivery.
  };
}

export async function deliverOne({queue,send}){
  await queue.expire();
  const job=await queue.claim();
  if(!job) return 'idle';
  let providerId;
  try{providerId=await send(job);}catch{
    await queue.failed(job,'delivery_failed');return 'retry';
  }
  // If this DB write fails after provider acceptance, retain the lease. A later
  // retry uses exactly the same provider idempotency key.
  await queue.accepted(job,providerId);
  return 'accepted';
}
