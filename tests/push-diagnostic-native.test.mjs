import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import pg from 'pg';import webpush from 'web-push';import {createClient} from '@supabase/supabase-js';import {realConfig,nativeRoot,secrets} from '../scripts/setup-real-auth.mjs';import {totp} from './helpers/totp.mjs';import {deliverBookingPush} from '../server/web-push.mjs';
test('self diagnostic requires real admin MFA, waits server delay and never creates a booking',{skip:process.env.MERYO_REAL_AUTH_TEST!=='1'},async()=>{
 const f=JSON.parse(await fs.readFile(path.join(nativeRoot,'shop-operations-accounts.json'),'utf8')),{anonKey}=await secrets(),db=new pg.Pool(realConfig),c=createClient('http://127.0.0.1:5178/__supabase',anonKey,{auth:{persistSession:false,autoRefreshToken:false}}),subscription={endpoint:'https://fcm.googleapis.com/native-diagnostic/'+crypto.randomUUID(),keys:{p256dh:webpush.generateVAPIDKeys().publicKey,auth:crypto.randomBytes(16).toString('base64url')}};
 try{
  assert.ifError((await c.auth.signInWithPassword(f.admin)).error);assert.ok((await c.rpc('meryo_push_estado')).error);assert.ok((await c.rpc('meryo_probar_push')).error);
  assert.ifError((await c.auth.mfa.challengeAndVerify({factorId:f.admin.factorId,code:totp(f.admin.totpSecret)})).error);
  assert.ifError((await c.rpc('meryo_registrar_push',{p_subscription:subscription})).error);
  const before=(await db.query('select count(*)::int n from public.reservas')).rows[0].n,r=await c.rpc('meryo_probar_push');assert.ifError(r.error);assert.ok(r.data);
  const job=(await db.query("select * from meryo_private.push_outbox where notification_id=$1",[r.data])).rows[0];assert.equal(job.user_id,f.admin.id);assert.equal(job.reserva_id,null);assert.ok(new Date(job.available_at)-new Date(job.created_at)>=29000);
  assert.ok((await c.rpc('meryo_probar_push')).error);assert.equal((await db.query('select count(*)::int n from public.reservas')).rows[0].n,before);
  const config={...webpush.generateVAPIDKeys(),subject:'mailto:isolated@example.com'};let sent=0;const send=async(_s,body)=>{const data=JSON.parse(body);assert.equal(data.event,'push_diagnostico');assert.equal(data.bookingId,null);sent++;};assert.equal(await deliverBookingPush(db,config,{send}),'idle');
  await db.query("update meryo_private.push_outbox set available_at=clock_timestamp()-interval '1 second' where id=$1",[job.id]);assert.equal(await deliverBookingPush(db,config,{send}),'provider_accepted');assert.equal(sent,1);
 }finally{await db.query('delete from meryo_private.push_subscriptions where endpoint=$1',[subscription.endpoint]);await c.auth.signOut({scope:'local'});await db.end();}
});
