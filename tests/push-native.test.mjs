import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import pg from 'pg';import webpush from 'web-push';import {createClient} from '@supabase/supabase-js';
import {realConfig,nativeRoot,secrets} from '../scripts/setup-real-auth.mjs';import {deliverBookingPush,acknowledgePush} from '../server/web-push.mjs';import {totp} from './helpers/totp.mjs';import {fechaLima,sumarDias} from '../src/lib/dates.js';
test('push native contract: actual Auth roles and bookings; mocked transport is not handset evidence',{skip:process.env.MERYO_REAL_AUTH_TEST!=='1'},async t=>{
 const f=JSON.parse(await fs.readFile(path.join(nativeRoot,'team-scheduling-accounts.json'),'utf8')),old=JSON.parse(await fs.readFile(path.join(nativeRoot,'shop-operations-accounts.json'),'utf8')),{anonKey}=await secrets(),pool=new pg.Pool({...realConfig,max:3}),clients=[];
 const login=async who=>{const c=createClient('http://127.0.0.1:5178/__supabase',anonKey,{auth:{persistSession:false,autoRefreshToken:false}});clients.push(c);assert.ifError((await c.auth.signInWithPassword(who)).error);return c;};
 const owner=await login(f.owner),staff=await login(f.staff),client=await login(f.customerB),admin=await login(old.admin),stranger=await login(old.stranger);
 const ids=[f.owner.id,f.staff.id,f.customerB.id,old.admin.id,old.stranger.id].filter(Boolean),prefix=crypto.randomUUID(),config={...webpush.generateVAPIDKeys(),subject:'mailto:native-tests@example.com'},sent=[],bookings=[];
 let failOnce=true;
 const send=async(subscription,payload,options)=>{assert.ok(options.TTL>0&&options.TTL<=900);assert.match(options.topic,/^[a-f0-9]{32}$/);if(subscription.endpoint.endsWith('/invalid'))throw Object.assign(Error('invalid'),{statusCode:410});if(subscription.endpoint.endsWith('/retry')&&failOnce){failOnce=false;throw Object.assign(Error('temporary'),{statusCode:503});}sent.push({endpoint:subscription.endpoint,data:JSON.parse(payload)});};
 const subscription=suffix=>({endpoint:`https://fcm.googleapis.com/meryo-native-${prefix}/${suffix}`,keys:{p256dh:webpush.generateVAPIDKeys().publicKey,auth:crypto.randomBytes(16).toString('base64url')}});
 const subOwner=subscription('owner'),subStaff=subscription('staff'),subClient=subscription('client'),subRetry=subscription('retry'),subBad=subscription('invalid'),subAdmin=subscription('admin'),subStranger=subscription('stranger');
 const drain=async()=>{for(let i=0;i<20;i++){const status=await deliverBookingPush(pool,config,{send});if(status==='idle')return;}throw Error('Unexpected queue size');};
 const date=[2,3,4].map(n=>sumarDias(fechaLima(new Date()),n)).find(d=>new Date(d+'T12:00:00Z').getUTCDay()!==0);
 const request=async()=>{const slots=await client.rpc('meryo_horarios_barbero',{p_shop:f.shop,p_service:f.service,p_date:date,p_member:f.member});assert.ifError(slots.error);assert.ok(slots.data.length);const r=await client.rpc('meryo_solicitar_cita',{p_barberia_id:f.shop,p_servicio_id:f.service,p_barbero_id:f.member,p_inicio:slots.data[0].hora_inicio,p_nombre:'Cliente push aislado',p_telefono:'999999999',p_pedido:'Prueba aislada push',p_extra:0});assert.ifError(r.error);bookings.push(r.data);return r.data;};
 try{
  await pool.query("update meryo_private.push_outbox set status='expired' where status not in ('accepted','failed','expired')");
  await t.test('subscription belongs to the authenticated account; admin requires actual MFA',async()=>{
   assert.ifError((await owner.rpc('meryo_registrar_push',{p_subscription:subOwner})).error);assert.ok((await client.rpc('meryo_registrar_push',{p_subscription:subOwner})).error);
   for(const [c,s] of [[staff,subStaff],[client,subClient],[client,subRetry],[client,subBad],[stranger,subStranger]])assert.ifError((await c.rpc('meryo_registrar_push',{p_subscription:s})).error);
   assert.ok((await admin.rpc('meryo_registrar_push',{p_subscription:subAdmin})).error);
  });
  let booking;
  await t.test('new request reaches assigned barber and remains visible to owner, never a foreign user',async()=>{
   booking=await request();await drain();assert.ok(sent.some(s=>s.endpoint===subStaff.endpoint&&s.data.event==='reserva_solicitada'&&s.data.bookingId===booking));
   const ownerState=await owner.rpc('meryo_reservas_estado');assert.ifError(ownerState.error);assert.ok(ownerState.data.reservas.some(r=>r.id===booking));assert.ok(!sent.some(s=>s.endpoint===subStranger.endpoint));
  });
  await t.test('acceptance, bounded retry, per-endpoint deduplication and invalid endpoint cleanup',async()=>{
   assert.equal((await staff.rpc('responder_reserva',{p_reserva_id:booking,p_aceptar:true})).data,'aceptada');await drain();
   const accepted=sent.find(s=>s.endpoint===subClient.endpoint&&s.data.event==='reserva_aceptada');assert.equal(accepted.data.body,'Tu barbero aceptó la cita. Tienes 10 minutos para pagar el adelanto y confirmarla.');
   await pool.query("update meryo_private.push_outbox set available_at=clock_timestamp()-interval '1 second' where reserva_id=$1 and event='reserva_aceptada' and status='queued'",[booking]);await drain();
   assert.equal(sent.filter(s=>s.endpoint===subClient.endpoint&&s.data.event==='reserva_aceptada').length,1);assert.equal(sent.filter(s=>s.endpoint===subRetry.endpoint&&s.data.event==='reserva_aceptada').length,1);
   assert.equal((await pool.query('select count(*)::int n from meryo_private.push_subscriptions where endpoint=$1',[subBad.endpoint])).rows[0].n,0);
   assert.equal(await acknowledgePush(pool,{...accepted.data.receipt,token:'x'.repeat(43)}),false);assert.equal(await acknowledgePush(pool,accepted.data.receipt),true);assert.equal(await acknowledgePush(pool,{...accepted.data.receipt,kind:'clicked'}),true);
   const status=await client.rpc('meryo_push_estado');assert.ifError(status.error);assert.ok(status.data.ultimos.some(j=>j.recibida_en&&j.abierta_en));assert.ok(!JSON.stringify(status.data).includes('endpoint'));
  });
  await t.test('rejection and server expiry create customer pushes, stale acceptance is not sent',async()=>{
   const rejected=await request();assert.ifError((await staff.rpc('responder_reserva',{p_reserva_id:rejected,p_aceptar:false})).error);await drain();assert.ok(sent.some(s=>s.data.bookingId===rejected&&s.data.event==='reserva_rechazada'));
   await pool.query("update public.reservas set expira_pago_en=clock_timestamp()-interval '1 second' where id=$1",[booking]);await pool.query('select public.expirar_reservas_vencidas()');await drain();assert.ok(sent.some(s=>s.data.bookingId===booking&&s.data.event==='reserva_expirada'));
  });
  // Admin diagnostic is tested separately by the actual handset after publication.
 }finally{for(const id of bookings)await owner.rpc('cancelar_reserva_barbero',{p_reserva_id:id});for(const s of [subOwner,subStaff,subClient,subRetry,subBad,subAdmin,subStranger])await pool.query('delete from meryo_private.push_subscriptions where endpoint=$1',[s.endpoint]);for(const c of clients)await c.auth.signOut({scope:'local'});await pool.end();}
});
