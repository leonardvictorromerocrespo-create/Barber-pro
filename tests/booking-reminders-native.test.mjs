import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import webpush from 'web-push';
import {deliverBookingPush} from '../server/web-push.mjs';

test('the native scheduler deduplicates reminders and the worker discards canceled or moved starts',
 {skip:process.env.MERYO_REMINDERS_NATIVE_TEST!=='1'},async()=>{
 const db=new pg.Client({host:'127.0.0.1',port:55457,user:'meryo_test',database:'postgres',ssl:false});
 const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
 await db.connect();
 try{
  const target=(await db.query("select current_database() db, host(inet_server_addr()) host, inet_server_port() port,to_regclass('public.reservas') reservations")).rows[0];
  assert.deepEqual(target,{db:'postgres',host:'127.0.0.1',port:55457,reservations:null},'Requires a fresh, isolated PostgreSQL instance');
  const metadata=JSON.parse(await read('db/reference/storage-ci/system-metadata.json'));
  for(const role of metadata.roles)await db.query('create role "'+role.replaceAll('"','""')+'" nologin');
  await db.query('create role postgres nologin');
  for(const ext of metadata.extensionSchemas)await db.query('create extension "'+ext.name+'" with schema public');
  await db.query((await read('db/reference/storage-ci/schema.sql')).replace('CREATE SCHEMA public;','CREATE SCHEMA IF NOT EXISTS public;'));
  // Only register cron jobs in this fixture. The test runs their SQL explicitly.
  await db.query(`create schema cron;create table cron.job(jobid bigint generated always as identity,jobname text unique,schedule text,command text);
    create function cron.schedule(text,text,text) returns bigint language sql as 'insert into cron.job(jobname,schedule,command) values($1,$2,$3) returning jobid';
    create function cron.unschedule(bigint) returns boolean language sql as 'delete from cron.job where jobid=$1 returning true';`);
  for(const file of ['021_product_pickup_store.sql','028_no_show_guard.sql','030_booking_reminders.sql']){
   await db.query(await read('db/incremental/'+file));
  }
  const job=(await db.query("select schedule,command from cron.job where jobname='meryo-booking-reminders'")).rows[0];
  assert.deepEqual(job,{schedule:'* * * * *',command:'select meryo_private.enqueue_booking_reminders()'});
  for(const role of ['anon','authenticated','service_role']){
   const permission=(await db.query("select has_function_privilege($1,'meryo_private.enqueue_booking_reminders()','EXECUTE') allowed",[role])).rows[0];
   assert.equal(permission.allowed,false);
  }
  await db.query("insert into public.barberias(id,nombre) values(42,'Local sintético')");
  await db.query("insert into public.servicios(id,barberia_id,nombre,precio,duracion_min) values(7,42,'Corte',40,30)");
  await db.query("insert into public.horarios(barberia_id,dia_semana,hora_apertura,hora_cierre) select 42,i,'00:00','23:59:59' from generate_series(0,6) i");
  const addUser=async(rol)=>{
   const id=randomUUID();
   await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@example.test']);
   await db.query(`insert into public.profiles(id,rol,barberia_id,activo)
    values($1,$2,case when $2='barbero' then 42 else null end,true)
    on conflict(id) do update set rol=excluded.rol,barberia_id=excluded.barberia_id,activo=true`,[id,rol]);
   return id;
  };
  const client=await addUser('cliente'),barber=await addUser('barbero');
  const now=(await db.query('select clock_timestamp() now')).rows[0].now;
  const seed=async({minutes,paid=60,status='confirmada',arrived=false,customer=undefined}={})=>{
   const member=randomUUID(),professional=await addUser('barbero');
   await db.query("insert into public.meryo_team_members(id,barberia_id,user_id,display_name) values($1,42,$2,'Profesional sintético')",[member,professional]);
   await db.query("insert into public.meryo_team_hours(member_id,day,kind,starts,ends) select $1,i,'jornada','00:00','23:59:59' from generate_series(0,6) i",[member]);
   const id=randomUUID(),recipient=customer??await addUser('cliente');
   await db.query(`insert into public.reservas(id,barberia_id,servicio_id,cliente_id,cliente_nombre,cliente_telefono,
    servicio_nombre,duracion_min,inicio,fin,precio_total,monto_adelanto,estado,barbero_id,pagada_en,llegada_en)
    values($1,42,7,$2,'Cliente sintético','999999999','Corte',30,
    $3::timestamptz+make_interval(mins=>$4),$3::timestamptz+make_interval(mins=>$4+30),40,20,$5,$6,
    case when $7::int is not null then $3::timestamptz-make_interval(mins=>$7) end,
    case when $8 then $3::timestamptz end)`,[id,recipient,now,minutes,status,member,paid,arrived]);
   return {id,professional};
  };
  const due=await seed({minutes:24,customer:client}), canceled=await seed({minutes:24}), moved=await seed({minutes:24});
  const excluded=[
   await seed({minutes:27}), await seed({minutes:24,paid:0}),
   await seed({minutes:24,status:'aceptada',paid:null}), await seed({minutes:21}),
   await seed({minutes:24,arrived:true}), await seed({minutes:24,status:'cancelada_cliente'}),
  ];
  const enqueue=async()=> (await db.query('select meryo_private.enqueue_booking_reminders() n')).rows[0].n;
  assert.equal(await enqueue(),6);
  assert.equal(await enqueue(),0);
  const records=(await db.query("select reserva_id,user_id from meryo_private.push_outbox where event='reserva_recordatorio'")).rows;
  assert.equal(records.length,6);
  assert.ok(!records.some(row=>excluded.some(item=>item.id===row.reserva_id)||row.user_id===barber));
  assert.deepEqual(new Set(records.filter(row=>row.reserva_id===due.id).map(row=>row.user_id)),new Set([client,due.professional]));
  await db.query("update public.reservas set estado='cancelada_barbero' where id=$1",[canceled.id]);
  await db.query("update public.reservas set inicio=inicio+interval '1 hour',fin=fin+interval '1 hour' where id=$1",[moved.id]);
  const keys=webpush.generateVAPIDKeys();
  for(const id of [client,due.professional,canceled.professional,moved.professional,barber]){
   await db.query("insert into meryo_private.push_subscriptions(endpoint,user_id,p256dh,auth) values($1,$2,$3,$4)",
    ['https://fcm.googleapis.com/test-'+id,id,keys.publicKey,Buffer.alloc(16,1).toString('base64url')]);
  }
  const sent=[];
  const dispatch=()=>deliverBookingPush(db,{...keys,subject:'mailto:test@example.com'},{send:async(s,payload)=>sent.push({recipient:s.endpoint.split('test-')[1],...JSON.parse(payload)})});
  assert.equal(await dispatch(),'provider_accepted');
  assert.equal(await dispatch(),'provider_accepted');
  assert.equal(await dispatch(),'idle');
  assert.deepEqual(new Set(sent.map(item=>item.recipient)),new Set([client,due.professional]));
  for(const item of sent){assert.equal(item.bookingId,due.id);assert.match(item.body,/Local sintético.*hora de Lima/);}
  assert.equal((await db.query("select count(*)::int n from meryo_private.push_outbox where event='reserva_recordatorio' and status='expired'")).rows[0].n,4);
  await db.query("update public.reservas set inicio=$2::timestamptz+interval '23 minutes',fin=$2::timestamptz+interval '53 minutes' where id=$1",[moved.id,now]);
  assert.equal(await enqueue(),2,'A changed start is a new reminder, with the prior one expired');
  assert.equal(await enqueue(),0);
 }finally{await db.end();}
});
