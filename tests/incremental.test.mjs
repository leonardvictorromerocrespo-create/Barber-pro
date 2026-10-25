import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import pg from 'pg';
import { restoreReference } from './helpers/restore-reference.mjs';
import {NotificationQueue,deliverOne} from '../server/notifications.mjs';

// Fixed loopback-only destination. Never reads .env or DATABASE_URL.
const config = {host:'127.0.0.1',port:55440,user:'meryo_test_admin',database:'meryo_test'};
const ids = Array.from({length:6},(_,i)=>`10000000-0000-0000-0000-${String(i+1).padStart(12,'0')}`);
const [client,other,barber,otherBarber,inactive,admin] = ids;
async function connect(){const c=new pg.Client(config);await c.connect();return c;}
async function as(uid,sql,args=[],role='authenticated'){
  const c=await connect();try{await c.query('begin');await c.query(`set local role ${role}`);
    await c.query("select set_config('request.jwt.claim.sub',$1,true)",[uid??'']);
    const r=await c.query(sql,args);await c.query('commit');return r;
  }catch(e){await c.query('rollback');throw e;}finally{await c.end();}
}
let start;
const book=(uid=client,offset=0)=>as(uid,'select public.crear_reserva(1,1,$1,\'Cliente de prueba\',\'999999999\',null,0) as id',[new Date(start+offset*3600000)]);
const decide=(id,accept=true,uid=barber)=>as(uid,'select public.responder_reserva($1,$2) as state',[id,accept]);
const intent=(id,ref='receipt-1',live=false,role='service_role')=>as(null,"select public.registrar_intento_pago_verificado($1,$2,'sandbox-provider',$3,'merchant-test',$4,'tarjeta') as id",[id,client,ref,live],role);
const pay=(id,amount=1500,live=false,role='service_role')=>as(null,"select public.confirmar_pago_verificado($1,'sandbox-provider','receipt-1','merchant-test',$2,'PEN',$3) as state",[id,amount,live],role);

test('Incremental public contract: real PostgreSQL locks, RLS and verified payment',async t=>{
 const c=await connect();
 try{
  await restoreReference(c);
  // Historical privileges actually observed in the snapshot, without exercising TRUNCATE.
  assert.equal((await c.query("select has_table_privilege('anon','public.barberias','TRUNCATE') as allowed")).rows[0].allowed,true);
  for(const file of ['001_privileges_and_payment_lock.sql','002_manual_booking_flow.sql','003_verified_payment_contract.sql','004_external_notification_outbox.sql']){
    await c.query(await fs.readFile(new URL(`../db/incremental/${file}`,import.meta.url),'utf8'));
  }
  for (const [i,id] of ids.entries()) await c.query("insert into auth.users(id,email) values($1,$2)",[id,`test${i}@example.invalid`]);
  await c.query("insert into public.barberias(id,nombre,verificada,estado,acepta_auto) values(1,'A',true,'activa',true),(2,'B',true,'activa',false)");
  await c.query("update public.profiles set rol='barbero',barberia_id=case when id=$1 then 1 else 2 end where id in ($1,$2)",[barber,otherBarber]);
  await c.query("update public.profiles set activo=false where id=$1",[inactive]);
  await c.query("update public.profiles set rol='admin' where id=$1",[admin]);
  await c.query("insert into public.servicios(id,barberia_id,nombre,precio,duracion_min,activo) values(1,1,'Corte',30,30,true)");
  await c.query("insert into public.horarios(barberia_id,dia_semana,hora_apertura,hora_cierre) select 1,i,'00:00','23:59' from generate_series(0,6)i");
  await c.query("insert into public.configuracion(clave,valor) values('minutos_anticipacion_minima','30'),('paso_minutos','30'),('max_reservas_pendientes','2'),('adelanto_pct','90'),('minutos_respuesta_barbero','1'),('minutos_pago_cliente','15'),('comision_pct','10'),('horas_cancelacion_gratis','3')");
  start=Number((await c.query("select extract(epoch from ((current_date+2)+time '10:00') at time zone 'America/Lima')*1000 as start")).rows[0].start);
  const clean=()=>c.query('truncate meryo_private.payment_receipts,meryo_private.payment_intents,public.pagos,public.notificaciones,public.reservas cascade');
  await t.test('commercial gate closed by default; browser cannot bypass',async()=>{
    await assert.rejects(book(),/no estan habilitadas/);
    await assert.rejects(as(client,"update meryo_private.launch_settings set reservas_habilitadas=true"),{code:'42501'});
    await c.query("update meryo_private.launch_settings set reservas_habilitadas=true,entorno='staging'");
  });
  await t.test('dangerous table/sequence rights removed; profile role stays protected',async()=>{
    for(const role of ['anon','authenticated']){
      const {rows:[r]}=await c.query("select has_table_privilege($1,'public.barberias','TRUNCATE') as truncate,has_sequence_privilege($1,'public.barberias_id_seq','UPDATE') as seq",[role]);
      assert.deepEqual(r,{truncate:false,seq:false});
    }
    await assert.rejects(as(client,"update public.profiles set rol='admin' where id=$1",[client]),{code:'42501'});
    await assert.rejects(as(client,"select public.pagar_reserva_prueba(gen_random_uuid(),'yape')"),{code:'42501'});
    await assert.rejects(as(null,"select public.confirmar_pago_interno(gen_random_uuid(),'x','y','tarjeta')",[],'service_role'),{code:'42501'});
  });
  await t.test('active profile required; manual 5 min and deposit 50% despite old settings',async()=>{
    await assert.rejects(book(inactive),{code:'42501'});
    await assert.rejects(book(barber),/No puedes/);
    const id=(await book()).rows[0].id;
    const {rows:[r]}=await c.query('select *,extract(epoch from expira_respuesta_en-created_at) as seconds from public.reservas where id=$1',[id]);
    assert.equal(r.estado,'solicitada');assert.equal(Number(r.monto_adelanto),15);
    assert.ok(Math.abs(Number(r.seconds)-300)<1);assert.equal(r.expira_pago_en,null);
    await assert.rejects(decide(id,true,otherBarber),/no encontrada/);
    assert.equal((await decide(id)).rows[0].state,'aceptada');
    const {rows:[p]}=await c.query('select extract(epoch from expira_pago_en-aceptada_en) as seconds from public.reservas where id=$1',[id]);
    assert.ok(Math.abs(Number(p.seconds)-300)<1);
    await clean();
  });
  await t.test('ten simultaneous requests: only one can hold the same slot',async()=>{
    const results=await Promise.allSettled(Array.from({length:10},(_,i)=>book(i%2?client:other)));
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal((await c.query('select count(*)::int n from public.reservas')).rows[0].n,1);
    await clean();
  });
  await t.test('pending limit is serialized for one customer across different slots',async()=>{
    const results=await Promise.allSettled([book(client,0),book(client,1),book(client,2)]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,2);
    await clean();
  });
  await t.test('rejection and expiry free the slot without a browser',async()=>{
    let id=(await book()).rows[0].id;assert.equal((await decide(id,false)).rows[0].state,'rechazada');
    id=(await book()).rows[0].id;
    await c.query("update public.reservas set expira_respuesta_en=clock_timestamp()-interval '1 second' where id=$1",[id]);
    await as(null,'select public.expirar_reservas_vencidas()',[],'service_role');
    assert.ok((await book(other)).rows[0].id);await clean();
  });
  await t.test('deadline checked after waiting for the row lock',async()=>{
    const id=(await book()).rows[0].id;
    await c.query('begin');await c.query("update public.reservas set expira_respuesta_en=clock_timestamp()+interval '250 milliseconds' where id=$1",[id]);
    const waiting=decide(id);
    await c.query('select pg_sleep(0.4)');await c.query('commit');
    assert.equal((await waiting).rows[0].state,'expirada');await clean();
  });
  await t.test('RLS isolates customers and barber shops; direct confirmation forbidden',async()=>{
    const id=(await book()).rows[0].id;
    assert.equal((await as(other,'select id from public.reservas')).rowCount,0);
    assert.equal((await as(otherBarber,'select id from public.reservas')).rowCount,0);
    assert.equal((await as(barber,'select id from public.reservas')).rowCount,1);
    await c.query('update public.profiles set activo=false where id=$1',[client]);
    assert.equal((await as(client,'select id from public.reservas')).rowCount,0);
    await assert.rejects(as(client,'select public.dejar_resena($1,5,null)',[id]),{code:'42501'});
    await c.query('update public.profiles set activo=true where id=$1',[client]);
    await assert.rejects(as(client,"update public.reservas set estado='confirmada' where id=$1",[id]),{code:'42501'});
    await clean();
  });
  await t.test('server verification only, amount/merchant/currency validated, receipt replay idempotent',async()=>{
    const id=(await book()).rows[0].id;
    await assert.rejects(intent(id),/no disponible/);await decide(id);
    await assert.rejects(intent(id,'receipt-1',false,'authenticated'),{code:'42501'});
    const iid=(await intent(id)).rows[0].id;
    await assert.rejects(pay(iid,1500,false,'authenticated'),{code:'42501'});
    await assert.rejects(pay(iid,1),/no coincide/);
    await assert.rejects(as(null,"select public.confirmar_pago_verificado($1,'sandbox-provider','receipt-1','wrong',1500,'PEN',false)",[iid],'service_role'),/no coincide/);
    await assert.rejects(as(null,"select public.confirmar_pago_verificado($1,'sandbox-provider','receipt-1','merchant-test',1500,'USD',false)",[iid],'service_role'),/no coincide/);
    const results=await Promise.all([pay(iid),pay(iid)]);assert.ok(results.every(r=>r.rows[0].state==='confirmada'));
    assert.equal((await c.query('select count(*)::int n from public.pagos')).rows[0].n,1);
    assert.equal((await c.query('select comision_plataforma from public.pagos')).rows[0].comision_plataforma,null);
    await assert.rejects(as(client,'select public.cancelar_reserva_cliente($1)',[id]),/pendiente de politica/);
    await clean();
  });
  await t.test('late payment retained for reconciliation and never revives released slot',async()=>{
    const id=(await book()).rows[0].id;await decide(id);const iid=(await intent(id)).rows[0].id;
    await c.query("update public.reservas set expira_pago_en=clock_timestamp()-interval '1 second' where id=$1",[id]);
    assert.equal((await pay(iid)).rows[0].state,'requiere_conciliacion');
    assert.equal((await c.query('select estado from public.reservas where id=$1',[id])).rows[0].estado,'expirada');
    assert.ok((await book(other)).rows[0].id);
    assert.equal((await pay(iid)).rows[0].state,'requiere_conciliacion');await clean();
  });
  await t.test('production rejects sandbox even when called by trusted server',async()=>{
    const id=(await book()).rows[0].id;await decide(id);const iid=(await intent(id)).rows[0].id;
    await c.query("update meryo_private.launch_settings set entorno='production'");
    await assert.rejects(pay(iid),/Entorno/);
    assert.equal((await c.query('select estado from public.reservas where id=$1',[id])).rows[0].estado,'aceptada');
    await c.query("update meryo_private.launch_settings set entorno='staging'");await clean();
  });
  await t.test('payment and cancellation serialize on the same reservation',async()=>{
    const id=(await book()).rows[0].id;await decide(id);const iid=(await intent(id)).rows[0].id;
    await Promise.allSettled([pay(iid),as(client,'select public.cancelar_reserva_cliente($1)',[id])]);
    const {rows:[r]}=await c.query('select estado from public.reservas where id=$1',[id]);
    const {rows:[p]}=await c.query('select count(*)::int n from public.pagos where reserva_id=$1',[id]);
    assert.ok(['confirmada','cancelada_cliente'].includes(r.estado));
    assert.equal(p.n,r.estado==='confirmada'?1:0);await clean();
  });
  await t.test('outbox failure rolls back the reservation and notification together',async()=>{
    await c.query(`create function meryo_private.test_reject_outbox() returns trigger language plpgsql as $$begin raise exception 'synthetic queue failure';end;$$;
      create trigger test_reject_outbox before insert on meryo_private.notification_outbox for each row execute function meryo_private.test_reject_outbox()`);
    try{
      await assert.rejects(book(),/synthetic queue failure/);
      assert.equal((await c.query('select count(*)::int n from public.reservas')).rows[0].n,0);
      assert.equal((await c.query('select count(*)::int n from public.notificaciones')).rows[0].n,0);
    }finally{await c.query('drop trigger test_reject_outbox on meryo_private.notification_outbox; drop function meryo_private.test_reject_outbox()');}
  });
  await t.test('outbox persists without browser; two workers cannot send the same lease',async()=>{
    await c.query('truncate meryo_private.notification_outbox');
    await c.query("insert into meryo_private.notification_contacts(user_id,email,consented_at,verified_at,enabled) values($1,'barber@example.invalid',clock_timestamp(),clock_timestamp(),true)",[barber]);
    const id=(await book()).rows[0].id;
    const pool=new pg.Pool(config);const queue=new NotificationQueue(pool);
    try{
      const jobs=await Promise.all([queue.claim(),queue.claim()]);assert.equal(jobs.filter(Boolean).length,1);
      const job=jobs.find(Boolean);assert.equal(job.reserva_id,id);
      await queue.failed(job,'delivery_failed');
      await c.query("update meryo_private.notification_outbox set available_at=clock_timestamp()-interval '1 second'");
      const sent=[];assert.equal(await deliverOne({queue,send:async j=>{sent.push(j.id);return 'synthetic-provider-id';}}),'accepted');
      assert.equal(sent.length,1);
      assert.equal((await c.query('select status from meryo_private.notification_outbox')).rows[0].status,'accepted');
      await clean();
      const next=(await book()).rows[0].id;await decide(next,false);
      await queue.expire();assert.equal(await queue.claim(),null);
      assert.equal((await c.query('select status from meryo_private.notification_outbox')).rows[0].status,'expired');
    }finally{await pool.end();}
    await clean();
  });
 } finally{await c.end();}
});
