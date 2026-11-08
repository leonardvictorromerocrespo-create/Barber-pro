import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import {nativeRoot,realConfig,secrets} from '../scripts/setup-real-auth.mjs';

const makeClient=anonKey=>createClient('http://127.0.0.1:5178/__supabase',anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
const limaDate=offset=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(Date.now()+offset*86400000);

test('inspiration SQL migration, publication privacy, category isolation and referenced booking roll back on native staging',
 {skip:process.env.MERYO_REAL_AUTH_TEST!=='1'},async()=>{
  assert.deepEqual(realConfig,{host:'127.0.0.1',port:55440,user:'meryo_test_admin',database:'meryo_auth_local',ssl:false});
  const [ownerFixture,customerCredentials,strangerCredentials]=await Promise.all([
   fs.readFile(path.join(nativeRoot,'shop-operations-accounts.json'),'utf8').then(JSON.parse),
   fs.readFile(path.join(nativeRoot,'cliente-flujo-tests.json'),'utf8').then(JSON.parse),
   fs.readFile(path.join(nativeRoot,'cliente-reservas.json'),'utf8').then(JSON.parse),
  ]);
  const {anonKey}=await secrets();
  const owner=makeClient(anonKey),customer=makeClient(anonKey),stranger=makeClient(anonKey),anonymous=makeClient(anonKey);
  const clients=[owner,customer,stranger,anonymous];
  for(const [client,credentials] of [[owner,ownerFixture.owner],[customer,customerCredentials],[stranger,strangerCredentials]]){
   const {error}=await client.auth.signInWithPassword(credentials);assert.ifError(error);
  }
  const claims=async client=>{const {data,error}=await client.auth.getSession();assert.ifError(error);assert.ok(data.session?.access_token);return JSON.parse(Buffer.from(data.session.access_token.split('.')[1],'base64url'));};
  const ownerClaims=await claims(owner),customerClaims=await claims(customer),strangerClaims=await claims(stranger);
  const db=new pg.Client(realConfig);await db.connect();
  let tx=false;
  const role=async(name,jwt)=>{await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(jwt||{})]);await db.query(`set local role ${name}`);};
  const reset=async()=>db.query('reset role');
  const expectFailure=async(sql,params,pattern)=>{
   await db.query('savepoint expected_failure');
   let failure;
   try{await db.query(sql,params);}catch(error){failure=error;}
   await db.query('rollback to savepoint expected_failure');await db.query('release savepoint expected_failure');
   assert.ok(failure,'Expected the server to reject this operation');
   if(pattern)assert.match(failure.message,pattern);
   return failure;
  };
  let bookingId=null,assetId=null,publicationId=null,serviceId=null,memberId=null,shopId=null,originalPrice=null,objectPath=null;
  try{
   const target=(await db.query("select current_database() db,host(inet_server_addr()) host,inet_server_port() port")).rows[0];
   assert.deepEqual(target,{db:'meryo_auth_local',host:'127.0.0.1',port:55440});
   const existing=(await db.query("select to_regclass('meryo_private.inspiration_publications') is not null installed,to_regprocedure('public.meryo_solicitar_cita(bigint,bigint,timestamptz,text,text,text,numeric,uuid,uuid,numeric,uuid,numeric,numeric,numeric,uuid)') is not null overload")).rows[0];
   assert.equal(existing.installed,false,'Migration 027 must not already be installed in the disposable test transaction');
   assert.equal(existing.overload,false);

   await db.query('begin');tx=true;
   const source=await fs.readFile(new URL('../db/incremental/027_inspiration_publications.sql',import.meta.url),'utf8');
   const migration=source.replace(/^\s*begin\s*;/i,'').replace(/notify\s+pgrst\s*,\s*'reload schema'\s*;\s*commit\s*;\s*$/i,'');
   assert.notEqual(migration,source,'Migration transaction wrapper was removed for rollback-only validation');
   await db.query(migration);

   const ownerState=(await db.query(`select p.barberia_id shop_id,b.tipos_negocio,b.estado,b.verificada,public.meryo_barberia_publicable(b.id) publicable
     from public.profiles p join public.barberias b on b.id=p.barberia_id where p.id=$1`,[ownerFixture.owner.id])).rows[0];
   assert.ok(ownerState,'The isolated owner must have a local shop');
   assert.equal(ownerState.estado,'activa');assert.equal(ownerState.verificada,true);assert.equal(ownerState.publicable,true);
   shopId=ownerState.shop_id;
   const chosen=(await db.query(`select s.id service_id,s.precio,m.id member_id
     from public.servicios s join public.meryo_team_services assignment on assignment.service_id=s.id and assignment.active
     join public.meryo_team_members m on m.id=assignment.member_id and m.barberia_id=s.barberia_id and m.active
     join public.profiles professional on professional.id=m.user_id and professional.activo
     where s.barberia_id=$1 and s.activo and not s.requiere_evaluacion and s.precio>0 and s.duracion_min between 1 and 240
     order by s.id,m.id limit 1`,[shopId])).rows[0];
   assert.ok(chosen,'Fixture has an active assigned reservable service and professional');serviceId=chosen.service_id;memberId=chosen.member_id;originalPrice=Number(chosen.precio);
   const category=ownerState.tipos_negocio.includes('barberia')?'barberia':'belleza';
   const workCategory=category==='barberia'?'corte':'coloracion';

   // Exercise the existing Storage metadata publication operation with synthetic
   // metadata only; no file contents or customer media are copied or uploaded.
   const ext=crypto.randomUUID();objectPath=`${shopId}/${ext}.jpg`;
   await db.query('update meryo_private.shop_content_settings set uploads_enabled=true where id=1');
   await db.query("insert into storage.objects(bucket_id,name,owner_id,metadata) values('meryo-shop-content',$1,$2,$3)",
    [objectPath,ownerFixture.owner.id,JSON.stringify({size:256,mimetype:'image/jpeg'})]);
   await role('authenticated',ownerClaims);
   assetId=(await db.query("select public.meryo_publicar_archivo($1,'foto','Imagen sintética de prueba') id",[objectPath])).rows[0].id;
   publicationId=(await db.query(`select public.meryo_guardar_inspiracion(null,$1,$2,$3,'Estilo sintético','Fixture local de validación',$4,$5,true) id`,
    [assetId,category,workCategory,memberId,serviceId])).rows[0].id;
   const own=(await db.query('select public.meryo_inspiracion_propietario() records')).rows[0].records;
   assert.ok(own.some(row=>row.id===publicationId&&row.published),'Owner can see only its own saved publication through the guarded RPC');
   await reset();

   await role('authenticated',strangerClaims);
   await expectFailure(`select public.meryo_guardar_inspiracion(null,$1,$2,$3,'Intento ajeno','',null,null,true)`,[assetId,category,workCategory],/propietario|foto activa|autorizado/i);
   await expectFailure('select id from meryo_private.inspiration_publications where id=$1',[publicationId],/permission denied|privilege/i);
   await reset();

   await role('anon',null);
   const publicRows=(await db.query("select public.meryo_inspiracion($1,null,24,0) rows",[category])).rows[0].rows;
   const visible=publicRows.find(row=>row.id===publicationId);
   assert.ok(visible,'Approved, public, active publication is discoverable in its own category');
   assert.equal(visible.shop_name,(await db.query('select nombre from public.barberias where id=$1',[shopId])).rows[0].nombre);
   assert.equal(visible.can_request,true);
   const otherCategory=category==='barberia'?'belleza':'barberia';
   const otherRows=(await db.query('select public.meryo_inspiracion($1,null,24,0) rows',[otherCategory])).rows[0].rows;
   assert.ok(!otherRows.some(row=>row.id===publicationId),'A work is never leaked into a category the business did not select');
   const detail=(await db.query('select public.meryo_inspiracion_publicacion($1) detail',[publicationId])).rows[0].detail;
   assert.equal(detail.id,publicationId);assert.equal(detail.can_request,true);
   await reset();

   await db.query("update public.barberias set estado='pendiente',verificada=false where id=$1",[shopId]);
   await role('anon',null);
   const pending=(await db.query('select public.meryo_inspiracion($1,null,24,0) rows',[category])).rows[0].rows;
   assert.ok(!pending.some(row=>row.id===publicationId),'Pending/unapproved business work is not public');
   assert.equal((await db.query('select public.meryo_inspiracion_publicacion($1) detail',[publicationId])).rows[0].detail,null);
   await reset();
   await db.query("update public.barberias set estado='activa',verificada=true where id=$1",[shopId]);

   // A stale price is rejected before booking. Restore the fixture price inside
   // the same outer transaction, then reserve one available current slot.
   await db.query('update public.servicios set precio=$2 where id=$1',[serviceId,originalPrice+1]);
   await role('authenticated',customerClaims);
   const stale=await expectFailure(`select public.meryo_solicitar_cita($1::bigint,$2::bigint,$3::timestamptz,$4::text,$5::text,$6::text,$7::numeric,$8::uuid,null::uuid,null::numeric,null::uuid,null::numeric,null::numeric,$9::numeric,$10::uuid) id`,
    [shopId,serviceId,limaDate(3)+'T18:00:00-05:00','Cliente sintético','999999999','Prueba de referencia',0,memberId,originalPrice,publicationId],/precio del servicio cambió/i);
   assert.ok(stale);await reset();await db.query('update public.servicios set precio=$2 where id=$1',[serviceId,originalPrice]);

   let chosenSlot=null;
   await role('anon',null);
   for(let offset=2;offset<=14&&!chosenSlot;offset++){
    const slots=(await db.query('select hora_inicio from public.meryo_horarios_barbero($1,$2,$3::date,$4)',[shopId,serviceId,limaDate(offset),memberId])).rows;
    if(slots.length)chosenSlot=slots[0].hora_inicio;
   }
   assert.ok(chosenSlot,'An existing professional schedule must expose a future slot in the local fixture');
   await reset();
   await role('authenticated',customerClaims);
   bookingId=(await db.query(`select public.meryo_solicitar_cita($1::bigint,$2::bigint,$3::timestamptz,$4::text,$5::text,$6::text,$7::numeric,$8::uuid,null::uuid,null::numeric,null::uuid,null::numeric,null::numeric,$9::numeric,$10::uuid) id`,
    [shopId,serviceId,chosenSlot,'Cliente sintético','999999999','Reserva con referencia de estilo',0,memberId,originalPrice,publicationId])).rows[0].id;
   const reservation=(await db.query('select estado,precio_total,expira_respuesta_en,created_at,inspiration_publication_id,inspiration_title_snapshot from public.reservas where id=$1',[bookingId])).rows[0];
   assert.equal(reservation.estado,'solicitada');assert.equal(Number(reservation.precio_total),originalPrice);
   assert.equal(reservation.inspiration_publication_id,publicationId);assert.equal(reservation.inspiration_title_snapshot,'Estilo sintético');
   assert.ok(Math.abs((Date.parse(reservation.expira_respuesta_en)-Date.parse(reservation.created_at))/1000-900)<3,'Existing 15-minute server deadline is unchanged');
   await expectFailure(`select public.meryo_solicitar_cita($1::bigint,$2::bigint,$3::timestamptz,$4::text,$5::text,$6::text,$7::numeric,$8::uuid,null::uuid,null::numeric,null::uuid,null::numeric,null::numeric,$9::numeric,$10::uuid) id`,
    [shopId,serviceId,chosenSlot,'Segundo cliente sintético','999999999','Doble reserva',0,memberId,originalPrice,publicationId],/disponible|tomad|ocupad|solicit/i);
   const customerState=(await db.query('select public.meryo_reservas_estado() rows')).rows[0].rows;
   assert.ok(customerState.reservas.some(row=>row.id===bookingId&&row.inspiration_title_snapshot==='Estilo sintético'));
   await reset();
   await role('authenticated',strangerClaims);
   const strangerState=(await db.query('select public.meryo_reservas_estado() rows')).rows[0].rows;
   assert.ok(!strangerState.reservas.some(row=>row.id===bookingId),'Un unrelated customer cannot read the referenced booking');
   await reset();
   await role('authenticated',ownerClaims);
   const ownerStateAfter=(await db.query('select public.meryo_reservas_estado() rows')).rows[0].rows;
   assert.ok(ownerStateAfter.reservas.some(row=>row.id===bookingId&&row.inspiration_title_snapshot==='Estilo sintético'),'Assigned business can see the style on its request');
   await db.query('select public.meryo_retirar_archivo($1)',[assetId]);
   await reset();
   const retired=(await db.query('select published from meryo_private.inspiration_publications where id=$1',[publicationId])).rows[0];
   assert.equal(retired.published,false,'Retiring an asset hides its inspiration record without deleting its history');
   await role('authenticated',customerClaims);
   await expectFailure(`select public.meryo_solicitar_cita($1::bigint,$2::bigint,$3::timestamptz,$4::text,$5::text,$6::text,$7::numeric,$8::uuid,null::uuid,null::numeric,null::uuid,null::numeric,null::numeric,$9::numeric,$10::uuid) id`,
    [shopId,serviceId,chosenSlot,'Cliente sintético','999999999','Referencia retirada',0,memberId,originalPrice,publicationId],/trabajo ya no está publicado/i);
   await reset();
   await role('anon',null);
   assert.equal((await db.query('select public.meryo_inspiracion_publicacion($1) detail',[publicationId])).rows[0].detail,null);
   await reset();
  }finally{
   if(tx){await db.query('rollback');tx=false;}
   const after=(await db.query("select to_regclass('meryo_private.inspiration_publications') is not null installed, to_regprocedure('public.meryo_solicitar_cita(bigint,bigint,timestamptz,text,text,text,numeric,uuid,uuid,numeric,uuid,numeric,numeric,numeric,uuid)') is not null overload")).rows[0];
   assert.equal(after.installed,false,'The new schema was rolled back after local verification');assert.equal(after.overload,false);
   if(bookingId)assert.equal((await db.query('select count(*)::int n from public.reservas where id=$1',[bookingId])).rows[0].n,0,'Synthetic request did not persist');
   if(objectPath)assert.equal((await db.query("select count(*)::int n from storage.objects where bucket_id='meryo-shop-content' and name=$1",[objectPath])).rows[0].n,0,'Synthetic Storage metadata did not persist');
   await db.end();await Promise.all(clients.map(client=>client.auth.signOut({scope:'local'})));
  }
 });
