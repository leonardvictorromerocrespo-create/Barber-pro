import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import {nativeRoot,realConfig,secrets} from '../scripts/setup-real-auth.mjs';

test('arrival is durable, blocks no-show after 15 minutes, and preserves appointment completion and payment',
 {skip:process.env.MERYO_REAL_AUTH_TEST!=='1'},async()=>{
 assert.deepEqual(realConfig,{host:'127.0.0.1',port:55440,user:'meryo_test_admin',database:'meryo_auth_local',ssl:false});
 const team=JSON.parse(await fs.readFile(path.join(nativeRoot,'team-scheduling-accounts.json'),'utf8'));
 const shopFixture=JSON.parse(await fs.readFile(path.join(nativeRoot,'shop-operations-accounts.json'),'utf8'));
 const customerFixture=JSON.parse(await fs.readFile(path.join(nativeRoot,'cliente-reservas.json'),'utf8'));
 const {anonKey}=await secrets();
 const make=()=>createClient('http://127.0.0.1:5178/__supabase',anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const staff=make(),owner=make(),customer=make(),clients=[staff,owner,customer],db=new pg.Client(realConfig);
 for(const [client,credentials] of [[staff,team.staff],[owner,shopFixture.owner],[customer,customerFixture]])assert.ifError((await client.auth.signInWithPassword(credentials)).error);
 const tokenClaims=async client=>{const {data,error}=await client.auth.getSession();assert.ifError(error);assert.ok(data.session?.access_token);return JSON.parse(Buffer.from(data.session.access_token.split('.')[1],'base64url').toString('utf8'));};
 const [staffClaims,ownerClaims,customerClaims]=await Promise.all([tokenClaims(staff),tokenClaims(owner),tokenClaims(customer)]);
 await db.connect();let tx=false;
 const ids=[];let migrationApplied=false;
 const claims=async(jwt)=>{await db.query('reset role');await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(jwt)]);await db.query('set local role authenticated');};
 const reset=async()=>db.query('reset role');
 const expectFailure=async(run,pattern)=>{
  await db.query('savepoint expected_booking_action_failure');let failure;
  try{await run();}catch(error){failure=error;}
  await db.query('rollback to savepoint expected_booking_action_failure');await db.query('release savepoint expected_booking_action_failure');
  assert.ok(failure,'Expected the server to reject the appointment action');assert.match(failure.message,pattern);return failure;
 };
 try{
  const target=(await db.query('select current_database() db,host(inet_server_addr()) host,inet_server_port() port')).rows[0];
  assert.deepEqual(target,{db:'meryo_auth_local',host:'127.0.0.1',port:55440});
  const alreadyApplied=(await db.query("select position('reserva_no_asistio' in pg_get_functiondef('meryo_private.queue_push()'::regprocedure))>0 installed")).rows[0].installed;
  assert.equal(alreadyApplied,false,'The isolated test must start from a database without migration 028');
  const arrivalBefore=(await db.query("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='reservas' and column_name='llegada_en') present")).rows[0].present;
  assert.equal(arrivalBefore,false,'The isolated baseline has no reusable arrival marker');
  await db.query('begin');tx=true;
  const source=await fs.readFile(new URL('../db/incremental/028_no_show_guard.sql',import.meta.url),'utf8');
  const migration=source.replace(/^\s*begin\s*;/i,'').replace(/notify\s+pgrst\s*,\s*'reload schema'\s*;\s*commit\s*;\s*$/i,'');
  assert.notEqual(migration,source,'The migration wrapper is stripped so the isolated test can roll back');
  await db.query(migration);migrationApplied=true;
  assert.equal((await db.query("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='reservas' and column_name='llegada_en') present")).rows[0].present,true,'The candidate adds the durable arrival marker');

  const shopId=team.shop,memberId=team.member,serviceId=team.service,customerId=customerClaims.sub;
  const actual=(await db.query(`select m.barberia_id,m.user_id,m.active,sv.precio,sv.duracion_min
    from public.meryo_team_members m join public.servicios sv on sv.id=$3 and sv.barberia_id=m.barberia_id
    where m.id=$2 and m.barberia_id=$1`,[shopId,memberId,serviceId])).rows[0];
  assert.ok(actual?.active,'Use the existing active isolated test barber and service');
  assert.equal(actual.user_id,team.staff.id,'The no-show actor is the assigned professional');
  assert.ok(Number(actual.precio)>0&&Number(actual.duracion_min)>0);
  assert.ok((await db.query('select 1 from public.profiles where id=$1 and activo and rol=\'cliente\'',[customerId])).rowCount,'Customer fixture is an active local account');

  const findStart=async({future=false,used=[]}={})=>{
   const dates=future
    ?["(current_date+1)::date","(current_date+30)::date"]
    :["date '2010-01-01'","(current_date-90)::date"];
   const {rows}=await db.query(`with candidate as (
    select ((d.day::date+h.starts) at time zone 'America/Lima') starts_at,
           ((d.day::date+h.starts+make_interval(mins=>sv.duracion_min)) at time zone 'America/Lima') ends_at
    from generate_series(${dates[0]},${dates[1]},interval '1 day') d(day)
    join public.meryo_team_hours h on h.member_id=$2 and h.active and h.kind='jornada'
      and h.day=extract(dow from d.day)::int
    join public.horarios gh on gh.barberia_id=$1 and gh.dia_semana=h.day
    join public.servicios sv on sv.id=$3 and sv.barberia_id=$1
    where h.starts>=gh.hora_apertura
      and h.starts+make_interval(mins=>sv.duracion_min)<=h.ends
      and h.starts+make_interval(mins=>sv.duracion_min)<=gh.hora_cierre
   ) select c.* from candidate c
     where meryo_private.member_time_ok($2,c.starts_at,c.ends_at)
     and not exists(select 1 from public.reservas r where r.estado in ('solicitada','aceptada','confirmada')
       and r.barberia_id=$1 and (r.barbero_id=$2 or r.barbero_id is null)
       and tstzrange(r.inicio,r.fin,'[)')&&tstzrange(c.starts_at,c.ends_at,'[)'))
   order by c.starts_at ${future?'asc':'desc'} limit 100`,[shopId,memberId,serviceId]);
   return rows.find(row=>!used.includes(new Date(row.starts_at).toISOString()));
  };
  const fixtures=[];
  const createBooking=async({future=false,paid=false,completed=false,used=[],arrivalOffsetMinutes=null}={})=>{
   const slot=await findStart({future,used});assert.ok(slot,'Isolated schedule has an available synthetic test time');
   const id=crypto.randomUUID(),price=Number(actual.precio),advance=Math.round(price*50)/100,start=new Date(slot.starts_at).toISOString(),end=new Date(slot.ends_at).toISOString();
   const state=completed?'completada':'confirmada';
   await db.query(`insert into public.reservas(id,barbero_id,barbero_nombre,barberia_id,servicio_id,cliente_id,cliente_nombre,cliente_telefono,servicio_nombre,duracion_min,inicio,fin,precio_total,monto_adelanto,estado,pagada_en,llegada_en)
    values($1,$2,$3,$4,$5,$6,'Cliente sintético de no-asistencia','999999999',$7,$8,$9,$10,$11,$12,$13,case when $14 then clock_timestamp() end,
      case when $15::int is null then null else $9::timestamptz+make_interval(mins=>$15::int) end)`,
    [id,memberId,team.staff.display_name||'Profesional de prueba',shopId,serviceId,customerId,'Servicio aislado de prueba',actual.duracion_min,start,end,price,advance,state,paid,arrivalOffsetMinutes]);
   if(paid)await db.query(`insert into public.pagos(reserva_id,monto,moneda,metodo,proveedor,proveedor_ref,estado,pagado_en)
     values($1,$2,'PEN','yape','meryo-no-show-isolated-test',$3,'pagado',clock_timestamp())`,[id,advance,crypto.randomUUID()]);
   ids.push(id);fixtures.push({id,start,paid,completed});return {id,start};
  };
  const mark=async(id,attended=false)=>db.query('select public.marcar_asistencia($1,$2)',[id,attended]);
  const arrive=async(id)=>db.query('select public.marcar_llegada($1) llegada_en',[id]);

  const future=await createBooking({future:true,paid:true});
  const used=[future.start];
  await claims(staffClaims);
  await expectFailure(()=>mark(future.id,false),/15 minutos/);
  await reset();
  let state=(await db.query('select estado,pagada_en from public.reservas where id=$1',[future.id])).rows[0];
  assert.equal(state.estado,'confirmada');assert.ok(state.pagada_en,'A too-early attempt leaves the appointment intact');

  // A confirmed customer may be checked in before the scheduled start. The
  // arrival time is recorded once, and even that timestamp blocks no-show.
  const earlyArrival=await createBooking({future:true,paid:true,used});used.push(earlyArrival.start);
  await claims(staffClaims);
  const firstArrival=(await arrive(earlyArrival.id)).rows[0].llegada_en;
  const duplicateArrival=(await arrive(earlyArrival.id)).rows[0].llegada_en;
  await expectFailure(()=>mark(earlyArrival.id,false),/llegada ya fue registrada/);
  await reset();
  assert.ok(firstArrival instanceof Date);assert.equal(duplicateArrival.getTime(),firstArrival.getTime(),'Repeated arrival registration does not overwrite its timestamp');
  state=(await db.query('select estado,inicio,llegada_en from public.reservas where id=$1',[earlyArrival.id])).rows[0];
  assert.equal(state.estado,'confirmada');assert.ok(state.inicio>state.llegada_en,'The professional can register arrival before the appointment begins');
  if(ownerClaims.sub!==staffClaims.sub){
   await claims(ownerClaims);await expectFailure(()=>arrive(earlyArrival.id),/Solo el profesional asignado/);await reset();
  }
  await claims(customerClaims);await expectFailure(()=>arrive(earlyArrival.id),/No autorizado para esta cita/);await reset();

  // Synthetic history records arrival ten minutes after start, then remains
  // waiting long past the 15-minute threshold. No schedule guards are changed.
  const waiting=await createBooking({paid:true,used,arrivalOffsetMinutes:10});used.push(waiting.start);
  state=(await db.query('select inicio,llegada_en from public.reservas where id=$1',[waiting.id])).rows[0];
  assert.ok(state.llegada_en>=state.inicio&&state.llegada_en<=new Date(state.inicio.getTime()+15*60_000),'The customer arrived within the first 15 minutes');
  assert.ok((await db.query('select clock_timestamp()>=inicio+interval \'15 minutes\' passed from public.reservas where id=$1',[waiting.id])).rows[0].passed,'The synthetic appointment remains waiting beyond the 15-minute threshold');
  await claims(staffClaims);
  await expectFailure(()=>mark(waiting.id,false),/llegada ya fue registrada/);
  await reset();
  state=(await db.query('select estado,llegada_en from public.reservas where id=$1',[waiting.id])).rows[0];
  assert.equal(state.estado,'confirmada','Arrival keeps the booking open while the customer waits');assert.ok(state.llegada_en);
  const waitingPaymentCount=(await db.query('select count(*)::int n from public.pagos where reserva_id=$1',[waiting.id])).rows[0].n;
  await claims(staffClaims);await mark(waiting.id,true);await reset();
  state=(await db.query('select estado,llegada_en from public.reservas where id=$1',[waiting.id])).rows[0];
  assert.equal(state.estado,'completada','The existing finish appointment path still works after arrival');assert.ok(state.llegada_en,'Finishing does not erase arrival history');
  assert.equal((await db.query("select count(*)::int n from public.notificaciones where reserva_id=$1 and tipo='pedir_resena'",[waiting.id])).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from public.pagos where reserva_id=$1',[waiting.id])).rows[0].n,waitingPaymentCount,'Arrival and completion do not create charges');
  assert.equal((await db.query("select estado from public.pagos where reserva_id=$1",[waiting.id])).rows[0].estado,'pagado','Arrival and completion preserve the paid advance');

  const unpaid=await createBooking({used});used.push(unpaid.start);
  await claims(staffClaims);
  await expectFailure(()=>mark(unpaid.id,false),/adelanto verificado y pagado/);
  await reset();

  const paid=await createBooking({paid:true,used});used.push(paid.start);
  const paymentsBefore=(await db.query('select count(*)::int n from public.pagos where reserva_id=$1',[paid.id])).rows[0].n;
  await claims(staffClaims);
  await mark(paid.id,false);
  await reset();
  state=(await db.query('select estado,cerrada_en from public.reservas where id=$1',[paid.id])).rows[0];
  assert.equal(state.estado,'no_asistio');assert.ok(state.cerrada_en);
  const payment=(await db.query('select estado,monto,moneda from public.pagos where reserva_id=$1',[paid.id])).rows[0];
  assert.equal(payment.estado,'pagado');assert.equal(Number(payment.monto),Math.round(Number(actual.precio)*50)/100);assert.equal(payment.moneda,'PEN');
  assert.equal((await db.query('select count(*)::int n from public.pagos where reserva_id=$1',[paid.id])).rows[0].n,paymentsBefore,'No additional charge or payment row is created');
  const note=(await db.query(`select user_id,titulo,mensaje,tipo,reserva_id from public.notificaciones where reserva_id=$1`,[paid.id])).rows[0];
  assert.equal(note.user_id,customerId);assert.equal(note.tipo,'reserva_no_asistio');assert.match(note.mensaje,/adelanto pagado queda para la barbería; no se generó otro cobro/i);
  const push=(await db.query('select user_id,event,reserva_id from meryo_private.push_outbox where reserva_id=$1',[paid.id])).rows[0];
  assert.deepEqual(push,{user_id:customerId,event:'reserva_no_asistio',reserva_id:paid.id});

  const arrived=await createBooking({paid:true,completed:true,used});used.push(arrived.start);
  await claims(staffClaims);
  await expectFailure(()=>mark(arrived.id,false),/Solo se marcan citas confirmadas/);
  await reset();

  const attended=await createBooking({used});
  await claims(staffClaims);await mark(attended.id,true);await reset();
  state=(await db.query('select estado from public.reservas where id=$1',[attended.id])).rows[0];
  assert.equal(state.estado,'completada','Existing attendance completion remains available');
  assert.equal((await db.query("select count(*)::int n from public.notificaciones where reserva_id=$1 and tipo='pedir_resena'",[attended.id])).rows[0].n,1);

  // A shop owner who is not the assigned professional cannot override the
  // assigned barber's explicit no-show confirmation.
  if(ownerClaims.sub!==staffClaims.sub){
   const assigned=await createBooking({paid:true,used});
   await claims(ownerClaims);
   await expectFailure(()=>mark(assigned.id,false),/Solo el profesional asignado/);
   await reset();
  }
 }finally{
  if(tx){await db.query('rollback');tx=false;}
  if(migrationApplied){
   const exists=(await db.query("select position('reserva_no_asistio' in pg_get_functiondef('meryo_private.queue_push()'::regprocedure))>0 installed")).rows[0].installed;
   assert.equal(exists,false,'The migration and synthetic fixtures are rolled back after isolated verification');
   const arrivalColumn=(await db.query("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='reservas' and column_name='llegada_en') present")).rows[0].present;
   assert.equal(arrivalColumn,false,'The isolated database does not keep the candidate arrival column after rollback');
  }
  await db.end();await Promise.all(clients.map(client=>client.auth.signOut({scope:'local'})));
 }
});
