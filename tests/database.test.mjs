import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import pg from 'pg';

// Intentionally hard-coded LOOPBACK and dedicated database. Never reads production env.
const config={host:'127.0.0.1',port:55440,user:'meryo_test_admin',database:'meryo_test'};
const ids = Array.from({length:12},(_,i)=>`00000000-0000-0000-0000-${String(i+1).padStart(12,'0')}`);
const [shop,shop2,customer,customer2,barber,barber2,inactive,service,service2,slot,slot2,slot3]=ids;
async function connect(){const c=new pg.Client(config);await c.connect();return c;}
async function asUser(uid,sql,args=[],role='authenticated'){
 const c=await connect();try{await c.query('begin');await c.query(`set local role ${role}`);
 await c.query("select set_config('request.jwt.claim.sub',$1,true)",[uid??'']);
 const result=await c.query(sql,args);await c.query('commit');return result;
 }catch(e){await c.query('rollback');throw e;}finally{await c.end();}
}
// Calling composite RPC through FROM is essential: avoid repeated evaluation per column.
const book=(uid=customer,s=slot)=>asUser(uid,'select * from meryo.request_booking($1,$2,$3,$4)',[s,service,'Cliente','999999999']);
const decide=(id,uid=barber,yes=true)=>asUser(uid,'select * from meryo.decide_booking($1,$2)',[id,yes]);
const pay=(id,ref='payment-1',amount=1500,role='service_role')=>asUser(customer,'select * from meryo.verify_payment($1,$2,$3,$4,$5)',[id,'test-provider',ref,amount,'PEN'],role);

test('PostgreSQL: transitions, privileges, expiry, concurrency and atomic notifications',async t=>{
 const c=await connect();
 try{
 assert.equal((await c.query('select current_database() n')).rows[0].n,'meryo_test');
 await c.query('drop schema if exists meryo cascade; drop schema if exists auth cascade;');
 await c.query('create schema auth; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting(\'request.jwt.claim.sub\',true),\'\')::uuid $$;');
 await c.query('grant usage on schema auth to authenticated,service_role; grant execute on function auth.uid() to authenticated,service_role;');
 await c.query(await fs.readFile(new URL('../db/candidate/001_reservations.sql',import.meta.url),'utf8'));
 await c.query('insert into meryo.shops(id,name) values($1,\'A\'),($2,\'B\')',[shop,shop2]);
 await c.query("insert into meryo.accounts(id,role,shop_id,active) values($1,'cliente',null,true),($2,'cliente',null,true),($3,'barbero',$6,true),($4,'barbero',$7,true),($5,'cliente',null,false)",[customer,customer2,barber,barber2,inactive,shop,shop2]);
 await c.query("insert into meryo.services(id,shop_id,name,price_cents,duration_minutes) values($1,$2,'Corte',3000,45),($3,$4,'Corte B',4000,45)",[service,shop,service2,shop2]);
 for(let i=0;i<3;i++)await c.query("insert into meryo.slots(id,shop_id,starts_at,ends_at) values($1,$2,now()+interval '1 day'+$3*interval '1 hour',now()+interval '1 day'+($3+1)*interval '1 hour')",[[slot,slot2,slot3][i],shop,i]);
 const clean=()=>c.query('truncate meryo.notifications,meryo.bookings');
 await t.test('untrusted roles cannot write, escalate or confirm',async()=>{
  await assert.rejects(book(inactive),{code:'42501'});
  await assert.rejects(book(barber),{code:'42501'});
  await assert.rejects(asUser(customer,"update meryo.accounts set role='admin'"),{code:'42501'});
  await assert.rejects(asUser(customer,"insert into meryo.notifications(booking_id,user_id,event) values($1,$2,'fake')",[slot,customer]),{code:'42501'});
  await assert.rejects(asUser(customer,'select meryo.expire_bookings()'),{code:'42501'});
  await assert.rejects(asUser(customer,'select * from meryo.bookings',[],'anon'),{code:'42501'});
 });
 await t.test('request → acceptance → verified deposit, receipt replay idempotent',async()=>{
  const b=(await book()).rows[0];assert.equal(b.status,'solicitada');assert.equal(b.deposit_cents,1500);assert.equal(b.commission_cents,null);
  assert.ok(Math.abs(new Date(b.accept_by)-new Date(b.created_at)-300000)<1000);
  assert.equal((await c.query('select count(*)::int n from meryo.notifications')).rows[0].n,2);
  await assert.rejects(pay(b.id),/Transición/);
  await assert.rejects(decide(b.id,barber2),{code:'42501'});
  const accepted=(await decide(b.id)).rows[0];assert.equal(accepted.status,'pendiente_pago');
  await assert.rejects(pay(b.id,'payment-1',1500,'authenticated'),{code:'42501'});
  await assert.rejects(pay(b.id,'payment-1',1),/Pago inválido/);
  assert.equal((await pay(b.id)).rows[0].status,'confirmada');
  assert.equal((await pay(b.id)).rows[0].status,'confirmada');
  await assert.rejects(decide(b.id),/Transición/);
  await assert.rejects(asUser(customer,'select * from meryo.cancel_booking($1)',[b.id]),/revisión/);
  assert.equal((await asUser(customer2,'select * from meryo.bookings')).rowCount,0);
  assert.equal((await asUser(barber2,'select * from meryo.bookings')).rowCount,0);
  assert.equal((await asUser(customer,'select * from meryo.bookings')).rowCount,1);
  assert.equal((await asUser(barber,'select * from meryo.bookings')).rowCount,1);
  await assert.rejects(asUser(customer,"update meryo.bookings set status='confirmada'"),{code:'42501'});
  await clean();
 });
 await t.test('10 real concurrent connections: exactly one booking and no orphan notifications',async()=>{
  const results=await Promise.allSettled(Array.from({length:10},(_,i)=>book(i%2?customer:customer2)));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.code==='23505').length,9);
  assert.equal((await c.query('select count(*)::int n from meryo.notifications')).rows[0].n,2);
  await clean();
 });
 await t.test('rejection and unpaid cancellation release the slot',async()=>{
  let b=(await book()).rows[0];assert.equal((await decide(b.id,barber,false)).rows[0].status,'rechazada');
  b=(await book()).rows[0];await assert.rejects(asUser(customer2,'select * from meryo.cancel_booking($1)',[b.id]),{code:'42501'});
  assert.equal((await asUser(customer,'select * from meryo.cancel_booking($1)',[b.id])).rows[0].status,'cancelada');
  await book();await clean();
 });
 await t.test('expired requests reject late acceptance and release without browser/scheduler',async()=>{
  let b=(await book()).rows[0];await c.query("update meryo.bookings set accept_by=clock_timestamp()-interval '1 millisecond' where id=$1",[b.id]);
  assert.equal((await asUser(customer,'select * from meryo.occupied_slots()')).rowCount,0);
  assert.equal((await decide(b.id)).rows[0].status,'vencida');
  b=(await book()).rows[0];await c.query("update meryo.bookings set accept_by=now()-interval '1 second' where id=$1",[b.id]);
  await book(customer2);assert.equal((await c.query("select count(*)::int n from meryo.bookings where status='solicitada'")).rows[0].n,1);await clean();
 });
 await t.test('configurable payment deadline and fee; late money never resurrects slot',async()=>{
  await c.query('update meryo.settings set payment_seconds=120,commission_cents=200');
  const b=(await book()).rows[0];assert.equal(b.commission_cents,200);
  const accepted=(await decide(b.id)).rows[0];assert.ok(new Date(accepted.pay_by)-Date.now()<=121000);
  await c.query("update meryo.bookings set pay_by=now()-interval '1 second' where id=$1",[b.id]);
  assert.equal((await pay(b.id)).rows[0].status,'vencida');await book(customer2);
  await assert.rejects(pay(b.id),/Transición/);
  await assert.rejects(c.query('update meryo.settings set commission_cents=500'),{code:'23514'});await clean();
 });
 await t.test('scheduled expiry and overlapping schedule protection',async()=>{
  const b=(await book()).rows[0];await c.query("update meryo.bookings set accept_by=now()-interval '1 second' where id=$1",[b.id]);
  assert.equal((await asUser(null,'select meryo.expire_bookings() n',[],'service_role')).rows[0].n,1);
  await assert.rejects(c.query('insert into meryo.slots(shop_id,starts_at,ends_at) select shop_id,starts_at,ends_at from meryo.slots limit 1'),{code:'23P01'});await clean();
 });
 await t.test('same provider receipt cannot confirm two reservations',async()=>{
  const a=(await book()).rows[0], b=(await book(customer2,slot2)).rows[0];await decide(a.id);await decide(b.id);
  await pay(a.id,'same');await assert.rejects(pay(b.id,'same'),{code:'23505'});
  assert.equal((await c.query('select status from meryo.bookings where id=$1',[b.id])).rows[0].status,'pendiente_pago');await clean();
 });
 await t.test('concurrent acceptance has only one winner',async()=>{
  const b=(await book()).rows[0];
  const results=await Promise.allSettled([decide(b.id),decide(b.id)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await c.query("select count(*)::int n from meryo.notifications where event='pendiente_pago'")).rows[0].n,2);await clean();
 });
 await t.test('cancellation racing payment never permits a partial transition',async()=>{
  const b=(await book()).rows[0];await decide(b.id);
  const results=await Promise.allSettled([pay(b.id,'race'),asUser(customer,'select * from meryo.cancel_booking($1)',[b.id])]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const saved=(await c.query('select * from meryo.bookings where id=$1',[b.id])).rows[0];
  assert.ok(['confirmada','cancelada'].includes(saved.status));
  assert.equal(saved.payment_reference!==null,saved.status==='confirmada');await clean();
 });
 await t.test('notification failure rolls back the reservation',async()=>{
  await c.query("create function meryo.fail_notification() returns trigger language plpgsql as $$ begin raise exception 'outbox unavailable'; end $$; create trigger fail_notification before insert on meryo.notifications for each row execute function meryo.fail_notification();");
  await assert.rejects(book(),/outbox unavailable/);
  assert.equal((await c.query('select count(*)::int n from meryo.bookings')).rows[0].n,0);
  await c.query('drop trigger fail_notification on meryo.notifications; drop function meryo.fail_notification();');
 });
 }finally{await c.end();}
});
