import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import pg from 'pg';
import {restoreReference} from './helpers/restore-reference.mjs';

const config={host:'127.0.0.1',port:55440,user:'meryo_test_admin',database:'meryo_test',ssl:false};
const ids=Array.from({length:7},(_,i)=>`30000000-0000-0000-0000-${String(i+1).padStart(12,'0')}`);
const [client,other,barber,otherBarber,inactive,admin,owner]=ids;
const barberMember='40000000-0000-0000-0000-000000000001';
const secondMember='40000000-0000-0000-0000-000000000002';
const ownerMember='40000000-0000-0000-0000-000000000003';

async function as(uid,sql,args=[]){
 const db=new pg.Client(config);await db.connect();
 try{await db.query('begin');await db.query('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);const result=await db.query(sql,args);await db.query('commit');return result;}
 catch(error){await db.query('rollback');throw error;}
 finally{await db.end();}
}

test('PostgreSQL RLS: reservation chat is gated by acceptance and limited to the customer and assigned barber',async()=>{
 const db=new pg.Client(config);await db.connect();
 try{
  const target=(await db.query('select current_database() as db,host(inet_server_addr()) as host,inet_server_port() as port,current_user as role')).rows[0];
  assert.deepEqual(target,{db:'meryo_test',host:'127.0.0.1',port:55440,role:'meryo_test_admin'});
  await restoreReference(db);
  for(const file of ['001_privileges_and_payment_lock.sql','002_manual_booking_flow.sql','003_verified_payment_contract.sql','004_external_notification_outbox.sql']){
   await db.query(await fs.readFile(new URL(`../db/incremental/${file}`,import.meta.url),'utf8'));
  }
  for(const [index,id] of ids.entries())await db.query('insert into auth.users(id,email) values($1,$2)',[id,`chat-${index}@example.invalid`]);
  await db.query("insert into public.barberias(id,nombre,verificada,estado,acepta_auto) values(1,'Salón sintético A',true,'activa',true),(2,'Salón sintético B',true,'activa',false)");
  await db.query("update public.profiles set rol='barbero',barberia_id=case when id in ($1,$3) then 1 else 2 end where id in ($1,$2,$3)",[barber,otherBarber,owner]);
  await db.query("update public.profiles set activo=false where id=$1",[inactive]);
  await db.query("update public.profiles set rol='admin' where id=$1",[admin]);
  await db.query("insert into public.servicios(id,barberia_id,nombre,precio,duracion_min,activo) values(1,1,'Corte sintético',30,30,true)");
  await db.query("insert into public.horarios(barberia_id,dia_semana,hora_apertura,hora_cierre) select 1,day,'00:00','23:59' from generate_series(0,6) day");
  await db.query("insert into public.configuracion(clave,valor) values('minutos_anticipacion_minima','30'),('paso_minutos','30'),('max_reservas_pendientes','2'),('adelanto_pct','90'),('minutos_respuesta_barbero','1'),('minutos_pago_cliente','15'),('comision_pct','10'),('horas_cancelacion_gratis','3')");
  await db.query('update meryo_private.launch_settings set reservas_habilitadas=true,entorno=\'staging\'');
  const start=Number((await db.query("select extract(epoch from ((current_date+2)+time '10:00') at time zone 'America/Lima')*1000 as start")).rows[0].start);
  const book=(uid,offset=0)=>as(uid,"select public.crear_reserva(1,1,$1,'Cliente de prueba','999999999',null,0) as id",[new Date(start+offset*3600000)]);
  await db.query(`create table public.meryo_team_members(
   id uuid primary key,barberia_id bigint not null references public.barberias(id),
   user_id uuid not null unique references public.profiles(id),active boolean not null default true
  );
  alter table public.reservas add column barbero_id uuid;
  alter table public.meryo_team_members enable row level security;
  revoke all on public.meryo_team_members from public,anon,authenticated;`);
  await db.query('insert into public.meryo_team_members(id,user_id,barberia_id) values($1,$2,1),($3,$4,2),($5,$6,1)',[barberMember,barber,secondMember,otherBarber,ownerMember,owner]);
  await db.query(`create function public.meryo_es_cita_asignada(p_member uuid) returns boolean
   language sql stable security definer set search_path='' as $$
    select public.meryo_cuenta_activa() and exists(
     select 1 from public.meryo_team_members m
     where m.id=p_member and m.user_id=(select auth.uid()) and m.active and m.barberia_id=public.mi_barberia_id()
    )
   $$;
   revoke all on function public.meryo_es_cita_asignada(uuid) from public,anon;
   grant execute on function public.meryo_es_cita_asignada(uuid) to authenticated;`);
  await db.query(await fs.readFile(new URL('../db/incremental/034_reservation_chat.sql',import.meta.url),'utf8'));

  const insert=(uid,reservationId,body,author=uid)=>as(uid,'insert into public.reserva_mensajes(reserva_id,autor_id,contenido) values($1,$2,$3) returning id',[reservationId,author,body]);
  const read=(uid,reservationId)=>as(uid,'select autor_id,contenido from public.reserva_mensajes where reserva_id=$1 order by creado_en,id',[reservationId]);
  const accepted=(await book(client)).rows[0].id;
  await db.query('update public.reservas set barbero_id=$2 where id=$1',[accepted,barberMember]);
  await as(barber,'select public.responder_reserva($1,true)',[accepted]);
  const unassigned=(await book(other,2)).rows[0].id;
  await as(barber,'select public.responder_reserva($1,true)',[unassigned]);
  assert.equal((await read(other,unassigned)).rowCount,0);
  await assert.rejects(insert(other,unassigned,'No hay profesional asignado'),{code:'42501'});
  const pending=(await book(other,1)).rows[0].id;
  await db.query("update public.reservas set barbero_id=$2,estado='solicitada',aceptada_en=null where id=$1",[pending,barberMember]);
  assert.equal((await read(other,pending)).rowCount,0);
  await assert.rejects(insert(other,pending,'Todavía no aceptada'),{code:'42501'});
  await as(barber,'select public.responder_reserva($1,true)',[pending]);
  await insert(other,pending,'Ahora sí está aceptada');
  assert.equal((await read(barber,pending)).rowCount,1);

  await insert(client,accepted,'Hola, soy el cliente');
  await insert(barber,accepted,'Te esperamos a la hora acordada');
  assert.deepEqual((await read(client,accepted)).rows.map(row=>row.contenido),['Hola, soy el cliente','Te esperamos a la hora acordada']);
  assert.equal((await read(barber,accepted)).rowCount,2);
  await assert.rejects(as(client,'update public.reserva_mensajes set contenido=$2 where reserva_id=$1',[accepted,'Mensaje editado']),{code:'42501'});
  await assert.rejects(as(client,'delete from public.reserva_mensajes where reserva_id=$1',[accepted]),{code:'42501'});
  for(const outsider of [other,otherBarber,owner,admin]){
   assert.equal((await read(outsider,accepted)).rowCount,0,`unexpected visibility for ${outsider}`);
   await assert.rejects(insert(outsider,accepted,'Acceso cruzado'),{code:'42501'});
  }
  await assert.rejects(insert(client,accepted,'Suplantación',other),{code:'42501'});
  await assert.rejects(as(client,'insert into public.reserva_mensajes(reserva_id,autor_id,contenido,creado_en) values($1,$2,$3,now())',[accepted,client,'No puede elegir fecha']),{code:'42501'});
  await assert.rejects(insert(client,accepted,'   '),{code:'23514'});
  await db.query('update public.profiles set activo=false where id=$1',[client]);
  assert.equal((await read(client,accepted)).rowCount,0);
  await assert.rejects(insert(client,accepted,'Cuenta inactiva'),{code:'42501'});
 }finally{
  try{await restoreReference(db);}finally{await db.end();}
 }
});
