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
const addDays=(date,days)=>{const value=new Date(`${date}T12:00:00Z`);value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10);};

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
 let originalSettings=null,originalTypes=[],secondOriginalTypes=[],serviceId=null,secondServiceId=null,promotionId=null,temporaryWindow=null,bookingId=null,promotionStart=limaDate(0),promotionSlot=null;
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
   for(let offset=0;offset<=14&&!promotionSlot;offset++){
    const date=limaDate(offset),rows=await anonymous.rpc('meryo_horarios_barbero',{p_shop:accounts.shop,p_service:serviceId,p_date:date,p_member:ownerMember});
    assert.ifError(rows.error);if(rows.data[0]){promotionStart=date;promotionSlot=rows.data[0];}
   }
   if(!promotionSlot){
    const existingDays=new Set((await db.query("select distinct day from public.meryo_team_hours where member_id=$1 and active and kind='jornada'",[ownerMember])).rows.map(row=>Number(row.day)));
    for(let offset=0;offset<=14&&!promotionSlot;offset++){
     const date=limaDate(offset),day=new Date(`${date}T12:00:00Z`).getUTCDay();if(existingDays.has(day))continue;
     const added=await accounts.owner.rpc('meryo_agregar_tramo',{p_member:ownerMember,p_day:day,p_kind:'jornada',p_start:'09:00',p_end:'18:00'});
     if(added.error)continue;temporaryWindow=added.data;
     const rows=await anonymous.rpc('meryo_horarios_barbero',{p_shop:accounts.shop,p_service:serviceId,p_date:date,p_member:ownerMember});assert.ifError(rows.error);
     if(rows.data[0]){promotionStart=date;promotionSlot=rows.data[0];}
    }
   }
   assert.ok(promotionSlot,'Synthetic salon has a future bookable slot to anchor its weekly day');

  await t.test('owner publishes a lower price and only beauty catalog exposes it',async()=>{
    const saved=await accounts.owner.rpc('meryo_guardar_promocion_belleza',{p_service_id:serviceId,p_promo_price:50,p_starts_on:promotionStart,p_ends_on:addDays(promotionStart,14),p_active:true});
   assert.ifError(saved.error);promotionId=saved.data;assert.ok(promotionId);
   const ownerView=await accounts.owner.rpc('meryo_promociones_belleza_propietario');assert.ifError(ownerView.error);
   assert.ok(ownerView.data.services.some(item=>String(item.id)===String(serviceId)));
   assert.ok(ownerView.data.promotions.some(item=>String(item.id)===String(promotionId)&&Number(item.regular_price)===80&&Number(item.promo_price)===50));
   const beauty=await anonymous.rpc('meryo_catalogo_categoria',{p_categoria:'belleza'});assert.ifError(beauty.error);
   const shop=beauty.data.find(item=>String(item.id)===String(accounts.shop));assert.ok(shop,'Approved salon appears in beauty catalog');
    const listed=shop.servicios.find(item=>String(item.id)===String(serviceId));assert.ok(listed);
    assert.equal(Number(listed.precio),80);
    if(promotionStart===limaDate(0))assert.equal(String(listed.promocion_belleza?.id),String(promotionId));
    else assert.equal(listed.promocion_belleza,null,'The ordinary catalog does not advertise an offer before its selected weekly day');
    const todayOffers=await anonymous.rpc('meryo_belleza_promociones_hoy');assert.ifError(todayOffers.error);
    if(promotionStart===limaDate(0))assert.ok(todayOffers.data.some(item=>String(item.promotion_id)===String(promotionId)),'The dedicated daily offer page exposes a live salon offer');
    else assert.ok(!todayOffers.data.some(item=>String(item.promotion_id)===String(promotionId)),'The dedicated page excludes offers for other dates');
   const barber=await anonymous.rpc('meryo_catalogo_categoria',{p_categoria:'barberia'});assert.ifError(barber.error);
   const barberListing=barber.data.find(item=>String(item.id)===String(accounts.shop));
   assert.ok(!barberListing||!barberListing.servicios.some(item=>String(item.id)===String(serviceId)&&item.promocion_belleza),'Beauty promotion is not exposed in barber catalog');
  });

   await t.test('weekly limit is business-wide across different services',async()=>{
    const created=await accounts.owner.from('servicios').insert({barberia_id:accounts.shop,nombre:'Manicure promoción sintética',categoria:'manicure',precio:60,duracion_min:30,activo:true,requiere_evaluacion:false}).select('id').single();
    assert.ifError(created.error);secondServiceId=created.data.id;
    const sameDay=await accounts.owner.rpc('meryo_guardar_promocion_belleza',{p_service_id:secondServiceId,p_promo_price:40,p_starts_on:promotionStart,p_ends_on:addDays(promotionStart,14),p_active:true});
    assert.ifError(sameDay.error);
    const weekday=new Date(`${promotionStart}T12:00:00Z`).getUTCDay();
    const otherDay=addDays(promotionStart,weekday===0?-1:1);
    const conflicting=await accounts.owner.rpc('meryo_guardar_promocion_belleza',{p_service_id:secondServiceId,p_promo_price:35,p_starts_on:otherDay,p_ends_on:otherDay,p_active:true});
    assert.ok(conflicting.error,'A second service cannot reserve another promo date in the same business week');
    assert.match(conflicting.error.message,/un solo día promocional|otro día promocional/i);
    const kept=await db.query('select empieza,termina,activa from meryo_private.beauty_service_promotions where barberia_id=$1 and servicio_id=$2',[accounts.shop,secondServiceId]);
    assert.equal(new Date(kept.rows[0].empieza).toISOString().slice(0,10),promotionStart,'The rejected change leaves the prior same-day offer untouched');
    assert.equal(kept.rows[0].activa,true);
   });

  await t.test('another salon owner cannot change the first salon offer',async()=>{
    const result=await secondOwner.rpc('meryo_guardar_promocion_belleza',{p_service_id:serviceId,p_promo_price:20,p_starts_on:promotionStart,p_ends_on:addDays(promotionStart,14),p_active:true});
   assert.ok(result.error,'Cross-business write should be rejected');
   const row=(await db.query('select barberia_id,precio_promocional from meryo_private.beauty_service_promotions where id=$1',[promotionId])).rows[0];
   assert.equal(String(row.barberia_id),String(accounts.shop));assert.equal(Number(row.precio_promocional),50);
  });

  await t.test('booking stores the active price; expiration hides and rejects it',async()=>{
   const beauty=await anonymous.rpc('meryo_catalogo_categoria',{p_categoria:'belleza'});assert.ifError(beauty.error);
   const shop=beauty.data.find(item=>String(item.id)===String(accounts.shop));
   const listed=shop?.servicios.find(item=>String(item.id)===String(serviceId));assert.equal(String(listed?.promocion_belleza?.id),String(promotionId));
    const slot=promotionSlot;assert.ok(slot,'Synthetic salon has at least one future appointment slot');
   const customerIdentity=await accounts.customer.auth.getUser();assert.ifError(customerIdentity.error);
    const outsideDayStart=new Date(Date.parse(slot.hora_inicio)+86400000).toISOString();
    const outsideDayApplies=await db.query('select meryo_private.beauty_service_promotion_applies($1,$2,$3,$4::timestamptz) applies',[promotionId,accounts.shop,serviceId,outsideDayStart]);
    assert.equal(outsideDayApplies.rows[0].applies,false,'The server-side price rule rejects a booking date outside the selected weekly day');
    const outsideDayAttempt=await accounts.customer.rpc('meryo_solicitar_cita',{
     p_barberia_id:accounts.shop,p_servicio_id:serviceId,p_inicio:outsideDayStart,p_nombre:'Cliente de prueba',p_telefono:'999999999',p_pedido:'Fuera del día promocional',p_extra:0,
     p_barbero_id:ownerMember,p_campaign_id:null,p_precio_habitual:null,p_beauty_campaign_id:promotionId,p_beauty_regular_price:80,p_beauty_expected_price:50,
    });
    assert.ok(outsideDayAttempt.error,'A reservation outside the chosen promo day must not receive the discounted price');
    assert.match(outsideDayAttempt.error.message,/oferta del salón venció o cambió/i);
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
  for(const id of [serviceId,secondServiceId].filter(Boolean)){await db.query('delete from meryo_private.beauty_service_promotions where barberia_id=$1 and servicio_id=$2',[accounts.shop,id]);await db.query('delete from public.meryo_team_services where service_id=$1',[id]);await db.query('delete from public.servicios where id=$1',[id]);}
  if(serviceId||secondServiceId)await db.query('select meryo_private.rebuild_business_promotion_calendar($1)',[accounts.shop]);
  if(originalTypes.length)await db.query('update public.barberias set tipos_negocio=$2 where id=$1',[accounts.shop,originalTypes]);
  if(secondOriginalTypes.length)await db.query('update public.barberias set tipos_negocio=$2 where id=$1',[secondFixture.shop,secondOriginalTypes]);
  if(originalSettings)await db.query('update meryo_private.launch_settings set reservas_habilitadas=$1,entorno=$2,pagos_habilitados=$3 where id=1',[originalSettings.reservas_habilitadas,originalSettings.entorno,originalSettings.pagos_habilitados]);
  await Promise.all([accounts.close(),secondOwner.auth.signOut({scope:'local'})]);await db.end();
 }
});
