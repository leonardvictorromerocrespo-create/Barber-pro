import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import pg from 'pg';
const config={host:'127.0.0.1',port:55440,user:'meryo_test_admin',database:'meryo_auth_local',ssl:false};
test('idle dispatch guard: no idle writes, due/future/leased retries preserved and grants unchanged',{skip:process.env.MERYO_IDLE_PG_TEST!=='1'},async()=>{
 const db=new pg.Client(config);await db.connect();
 try{
  await db.query('begin');const before=(await db.query("select pg_get_functiondef('meryo_private.wake_push()'::regprocedure) source,proacl::text acl from pg_proc where oid='meryo_private.wake_push()'::regprocedure")).rows[0];
  const sql=await fs.readFile('db/incremental/019_skip_idle_push.sql','utf8');await db.query(sql.replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,''));
  const refinement=await fs.readFile('db/incremental/020_skip_unreachable_push.sql','utf8');await db.query(refinement.replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,''));
  const after=(await db.query("select pg_get_functiondef('meryo_private.wake_push()'::regprocedure) source,proacl::text acl from pg_proc where oid='meryo_private.wake_push()'::regprocedure")).rows[0];assert.equal(after.acl,before.acl);assert.equal(after.source.replace('\n if not meryo_private.push_work_due() then return false;end if;',''),before.source);
  for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("select has_function_privilege($1,'meryo_private.push_work_due()','execute') ok",[role])).rows[0].ok,false);
  const fixture=(await db.query('select id,user_id from meryo_private.push_outbox o where not exists(select 1 from meryo_private.push_subscriptions s where s.user_id=o.user_id) order by id limit 1')).rows[0],id=fixture?.id;assert.ok(id,'Existing native push fixture required; no other database is created');
  await db.query("update meryo_private.push_outbox set status='expired' where status in ('pending_provider','queued','leased')");
  const due=async()=>(await db.query('select meryo_private.push_work_due() ok')).rows[0].ok;assert.equal(await due(),false);
  const signal=(await db.query('select last_signal from meryo_private.push_dispatch_settings where id=1')).rows[0]?.last_signal?.toISOString();assert.equal((await db.query('select meryo_private.wake_push() ok')).rows[0].ok,false);assert.equal((await db.query('select last_signal from meryo_private.push_dispatch_settings where id=1')).rows[0]?.last_signal?.toISOString(),signal);
  await db.query("update meryo_private.push_outbox set status='queued',created_at=clock_timestamp(),available_at=clock_timestamp()+interval '30 seconds',lease_until=null where id=$1",[id]);assert.equal(await due(),false);
  await db.query("update meryo_private.push_outbox set available_at=clock_timestamp()-interval '1 second' where id=$1",[id]);assert.equal(await due(),false,'No recipient device: avoid waking an idle sender');
  await db.query('savepoint before_device');await db.query("insert into meryo_private.push_subscriptions(endpoint,user_id,p256dh,auth) values('https://fcm.googleapis.com/meryo-idle-guard-native',$1,'unused-isolated-key','unused-isolated-auth')",[fixture.user_id]);assert.equal(await due(),true);
  await db.query("update meryo_private.push_outbox set status='leased',lease_until=clock_timestamp()+interval '40 seconds' where id=$1",[id]);assert.equal(await due(),false);
  await db.query("update meryo_private.push_outbox set lease_until=clock_timestamp()-interval '1 second' where id=$1",[id]);assert.equal(await due(),true);
  await db.query("update meryo_private.push_outbox set status='accepted' where id=$1",[id]);assert.equal(await due(),false);
  await db.query('rollback to savepoint before_device');assert.equal(await due(),false);await db.query("update meryo_private.push_outbox set created_at=clock_timestamp()-interval '2 days' where id=$1",[id]);assert.equal(await due(),true,'Keep the existing stale-job cleanup eligible even without devices');
 }finally{await db.query('rollback');await db.end();}
});
