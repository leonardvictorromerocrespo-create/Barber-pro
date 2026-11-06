import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import {bookingAccounts} from './helpers/real-booking.mjs';
import {nativeRoot,realConfig,secrets} from '../scripts/setup-real-auth.mjs';

const limaDate=offset=>{
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(Date.now()+offset*86400000));
 const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
 return `${values.year}-${values.month}-${values.day}`;
};

test('native isolated beauty promotions: owner scope, public price and expired offers are server-rejected',{skip:process.env.MERYO_REAL_AUTH_TEST!=='1'},async t=>{
 const accounts=await bookingAccounts({customerFile:'cliente-campania-50.json'});
 const {anonKey}=await secrets();
 const anonymous=createClient('http://127.0.0.1:5178/__supabase',anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const secondOwner=createClient('http://127.0.0.1:5178/__supabase',anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const secondFixture=JSON.parse(await fs.readFile(path.join(nativeRoot,'shop-onboarding-proof.json'),'utf8'));
 const secondCredentials=secondFixture.owner;
 const db=new pg.Client(realConfig);await db.connect();
 const {rows:[target]}=await db.query('select current_database() database,host(inet_server_addr()) host,inet_server_port() port');
 assert.deepEqual(target,{database:'meryo_auth_local',host:'127.0.0.1',port:55440});
 assert.notEqual(String(accounts.shop),String(secondFixture.shop));
 let originalSettings=null,originalTypes=[],secondOriginalTypes=[],serviceId=null,promotionId=null,temporaryWindow=null,bookingId=null;
 try{
  const ownerIdentity=await accounts.owner.auth.getUser();assert.ifError(ownerIdentity.error);
  const ownerShop=await accounts.owner.from('profiles').select('barberia_id').eq('id',ownerIdentity.data.user.id).single();assert.ifError(ownerShop.error);assert.equal(String(ownerShop.data.barberia_id),String(accounts.shop));
  const secondLogin=await secondOwner.auth.signInWithPassword(secondCredentials);assert.ifError(secondLogin.error);
  const secondIdentity=await secondOwner.auth.getUser();assert.ifError(secondIdentity.error);
  const secondProfile=await secondOwner.from('profiles').select('barberia_id,rol').eq('id',secondIdentity.data.user.id).single();assert.ifError(secondProfile.error);assert.equal(secondProfile.data.rol,'barbero');assert.equal(String(secondProfile.data.barberia_id),String(secondFixture.shop));
  originalSettings=(await db.query('select reservas_habilitadas,entorno,pagos_habilitados from meryo_private.launch_settings where id=1')).rows[0];
  originalTypes=(await db.query('select tipos_negocio from public.barberias where id=$1',[accounts.shop])).rows[0].tipos_negocio;
  secondOriginalTypes=(await db.query('select tipos_negocio from public.barberias where id=$1',[secondFixture.shop])).rows[0].tipos_negocio;
  await db.query("update meryo_private.launch_settings set reservas_habilitadas=true,entorno='disabled',pagos_habilitados=false where id=1");
  await db.query("update public.barberias set tipos_negocio=array(select distinct unnest(tipos_negocio||array['belleza']::text[])) where id=$1",[accounts.shop]);
  await db.query("update public.barberias set tipos_negocio=array(select distinct unnest(tipos_negocio||array['belleza']::text[])) where id=$1",[secondFixture.shop]);

  const service=await accounts.owner.from('servicios').insert({barberia_id:accounts.shop,nombre:'Peinado promoción sintética',categoria:'peinados',precio:80,duracion_min:30,activo:true,requiere_evaluacion:false}).select('id').single();
  assert.ifError(service.error);serviceId=service.data.id;
  const team=await accounts.owner.rpc('meryo_equipo');assert.ifError(team.error);
  const ownerMember=team.data.members.find(member=>member.propietario)?.id;assert.ok(ownerMember,'The salon owner has a bookable team identity');

  await t.test('owner publishes a lower price and only beauty catalog exposes it',async()=>{
   const saved=await accounts.owner.rpc('meryo_guardar_promocion_belleza',{p_service_id:serviceId,p_promo_price:50,p_starts_on:limaDate(0),p_ends_on:limaDate(5),p_active:true});
   assert.ifError(saved.error);promotionId=saved.data;assert.ok(promotionId);
   const ownerView=await accounts.owner.rpc('meryo_promociones_belleza_propietario');assert.ifError(ownerView.error);
   assert.ok(ownerView.data.services.some(item=>String(item.id)===String(serviceId)));
   assert.ok(ownerView.data.promotions.some(item=>String(item.id)===String(promotionId)&&Number(item.regular_price)===80&&Number(item.promo_price)===50));
   const beauty=await anonymous.rpc('meryo_catalogo_categoria',{p_categoria:'belleza'});assert.ifError(beauty.error);
   const shop=beauty.data.find(item=>String(item.id)===String(accounts.shop));assert.ok(shop,'Approved salon appears in beauty catalog');
   const listed=shop.servicios.find(item=>String(item.id)===String(serviceId));assert.equal(String(listed.promocion_belleza.id),String(promotionId));
   assert.equal(Number(listed.precio),80);assert.equal(Number(listed.promocion_belleza.precio),50);
   const barber=await anonymous.rpc('meryo_catalogo_categoria',{p_categoria:'barberia'});assert.ifError(barber.error);
   const barberListing=barber.data.find(item=>String(item.id)===String(accounts.shop));
   assert.ok(!barberListing||!barberListing.servicios.some(item=>String(item.id)===String(serviceId)&&item.promocion_belleza),'Beauty promotion is not exposed in barber catalog');
  });

  await t.test('another salon owner cannot change the first salon offer',async()=>{
   const result=await secondOwner.rpc('meryo_guardar_promocion_belleza',{p_service_id:serviceId,p_promo_price:20,p_starts_on:limaDate(0),p_ends_on:limaDate(5),p_active:true});
   assert.ok(result.error,'Cross-business write should be rejected');
   const row=(await db.query('select barberia_id,precio_promocional from meryo_private.beauty_service_promotions where id=$1',[promotionId])).rows[0];
   assert.equal(String(row.barberia_id),String(accounts.shop));assert.equal(Number(row.precio_promocional),50);
  });

  await t.test('booking stores the active price; expiration hides and rejects it',async()=>{
   const beauty=await anonymous.rpc('meryo_catalogo_categoria',{p_categoria:'belleza'});assert.ifError(beauty.error);
   const shop=beauty.data.find(item=>String(item.id)===String(accounts.shop));
   const listed=shop?.servicios.find(item=>String(item.id)===String(serviceId));assert.equal(String(listed?.promocion_belleza?.id),String(promotionId));
   let slot=null;
   for(let offset=2;offset<=14&&!slot;offset++){
    const date=limaDate(offset),rows=await anonymous.rpc('meryo_horarios_barbero',{p_shop:accounts.shop,p_service:serviceId,p_date:date,p_member:ownerMember});
    assert.ifError(rows.error);slot=rows.data[0]||null;
   }
   if(!slot){
    const existingDays=new Set((await db.query("select distinct day from public.meryo_team_hours where member_id=$1 and active and kind='jornada'",[ownerMember])).rows.map(row=>Number(row.day)));
    for(let offset=2;offset<=14&&!slot;offset++){
     const date=limaDate(offset),day=new Date(`${date}T12:00:00Z`).getUTCDay();if(existingDays.has(day))continue;
     const added=await accounts.owner.rpc('meryo_agregar_tramo',{p_member:ownerMember,p_day:day,p_kind:'jornada',p_start:'09:00',p_end:'18:00'});
     if(added.error)continue;temporaryWindow=added.data;
     const rows=await anonymous.rpc('meryo_horarios_barbero',{p_shop:accounts.shop,p_service:serviceId,p_date:date,p_member:ownerMember});assert.ifError(rows.error);slot=rows.data[0]||null;
    }
   }
   assert.ok(slot,'Synthetic salon has at least one future appointment slot');
   const customerIdentity=await accounts.customer.auth.getUser();assert.ifError(customerIdentity.error);
   const valid=await accounts.customer.rpc('meryo_solicitar_cita',{
    p_barberia_id:accounts.shop,p_servicio_id:serviceId,p_inicio:slot.hora_inicio,p_nombre:'Cliente de prueba',p_telefono:'999999999',p_pedido:'Prueba sintética de promoción de salón',p_extra:0,
    p_barbero_id:ownerMember,p_campaign_id:null,p_precio_habitual:null,p_beauty_campaign_id:promotionId,p_beauty_regular_price:80,p_beauty_expected_price:50,
   });
   assert.ifError(valid.error);bookingId=valid.data;
   const saved=(await db.query('select estado,precio_total,precio_habitual,monto_adelanto,campania_belleza_id,expira_respuesta_en,created_at from public.reservas where id=$1',[bookingId])).rows[0];
   assert.equal(saved.estado,'solicitada');assert.equal(Number(saved.precio_habitual),80);assert.equal(Number(saved.precio_total),50);assert.equal(Number(saved.monto_adelanto),25);assert.equal(String(saved.campania_belleza_id),String(promotionId));
   assert.ok(Math.abs((Date.parse(saved.expira_respuesta_en)-Date.parse(saved.created_at))/1000-900)<2,'Existing 15-minute response window remains intact');
   assert.equal((await db.query('select pagos_habilitados from meryo_private.launch_settings where id=1')).rows[0].pagos_habilitados,false,'Payment processing stays disabled in the isolated test');
   const cancel=await accounts.customer.rpc('cancelar_reserva_cliente',{p_reserva_id:bookingId});assert.ifError(cancel.error);
   const attemptedAt=new Date().toISOString();
   await db.query('update meryo_private.beauty_service_promotions set empieza=$2,termina=$2 where id=$1',[promotionId,limaDate(-1)]);
   const expiredCatalog=await anonymous.rpc('meryo_catalogo_categoria',{p_categoria:'belleza'});assert.ifError(expiredCatalog.error);
   const expiredShop=expiredCatalog.data.find(item=>String(item.id)===String(accounts.shop));
   const expiredService=expiredShop?.servicios.find(item=>String(item.id)===String(serviceId));
   assert.equal(expiredService?.promocion_belleza,null,'Expired promotion is not returned to customers');
   const applicable=await db.query('select meryo_private.beauty_service_promotion_applies($1,$2,$3,now()) applies',[promotionId,accounts.shop,serviceId]);
   assert.equal(applicable.rows[0].applies,false,'Server-side predicate does not apply an expired offer');
   const attempt=await accounts.customer.rpc('meryo_solicitar_cita',{
    p_barberia_id:accounts.shop,p_servicio_id:serviceId,p_inicio:slot.hora_inicio,p_nombre:'Cliente de prueba',p_telefono:'999999999',p_pedido:'Oferta vencida, no reservar',p_extra:0,
    p_barbero_id:ownerMember,p_campaign_id:null,p_precio_habitual:null,p_beauty_campaign_id:promotionId,p_beauty_regular_price:80,p_beauty_expected_price:50,
   });
   assert.ok(attempt.error,'Booking RPC must reject an expired beauty promotion');assert.match(attempt.error.message,/oferta del salón venció o cambió/i);
   const bookings=await db.query('select count(*)::int total from public.reservas where cliente_id=$1 and servicio_id=$2 and inicio=$3 and created_at>=$4',[customerIdentity.data.user.id,serviceId,slot.hora_inicio,attemptedAt]);
   assert.equal(bookings.rows[0].total,0,'Expired offer creates no second reservation');
  });
 }finally{
  if(temporaryWindow)await accounts.owner.rpc('meryo_retirar_tramo',{p_id:temporaryWindow}).catch(()=>{});
  if(bookingId){
   await db.query('delete from meryo_private.payment_intents where reserva_id=$1',[bookingId]);
   await db.query('delete from meryo_private.push_outbox where reserva_id=$1',[bookingId]);
   await db.query('delete from meryo_private.reservation_events where reserva_id=$1',[bookingId]);
   await db.query('delete from public.pagos where reserva_id=$1',[bookingId]);
   await db.query('delete from public.resenas where reserva_id=$1',[bookingId]);
   await db.query('delete from public.reservas where id=$1',[bookingId]);
  }
  if(serviceId){await db.query('delete from meryo_private.beauty_service_promotions where barberia_id=$1 and servicio_id=$2',[accounts.shop,serviceId]);await db.query('delete from public.meryo_team_services where service_id=$1',[serviceId]);await db.query('delete from public.servicios where id=$1',[serviceId]);}
  if(originalTypes.length)await db.query('update public.barberias set tipos_negocio=$2 where id=$1',[accounts.shop,originalTypes]);
  if(secondOriginalTypes.length)await db.query('update public.barberias set tipos_negocio=$2 where id=$1',[secondFixture.shop,secondOriginalTypes]);
  if(originalSettings)await db.query('update meryo_private.launch_settings set reservas_habilitadas=$1,entorno=$2,pagos_habilitados=$3 where id=1',[originalSettings.reservas_habilitadas,originalSettings.entorno,originalSettings.pagos_habilitados]);
  await Promise.all([accounts.close(),secondOwner.auth.signOut({scope:'local'})]);await db.end();
 }
});
