import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMeryoApi,verifiedProfile,bookingLabel,mapShop} from '../src/lib/meryo-api.js';
import {createLocalClient} from '../src/lib/local-client.js';

// Unit doubles only. These do not create an application session or test Supabase Auth.
function clientFor(profile,answer={data:'saved-id',error:null}){
 const calls=[];
 const client={calls,auth:{getUser:async()=>({data:{user:{id:'real-subject'}},error:null})},
  from(table){const filters=[];const query={select(){return query;},eq(...args){filters.push(args);return query;},order(){return query;},single(){return query;},then(resolve){calls.push({table,filters});return Promise.resolve(resolve({data:table==='profiles'?profile:[],error:null}));}};return query;},
  rpc:async(name,args)=>{calls.push({name,args});return name==='meryo_reservas_config'?{data:{respuesta_segundos:900,modelo_comercial:'mensualidad'},error:null}:answer;}};
 return client;
}

test('catalog rejects legacy counters and reads only the server public catalogue',async()=>{
 const legacy={id:1,nombre:'Legacy',rating:4.9,total_resenas:324};
 assert.equal(mapShop(legacy).rating,null);assert.equal(mapShop(legacy).reviews,0);
 assert.equal(mapShop({...legacy,reviews_verified:true,total_resenas:0}).rating,null);
 assert.equal(mapShop({...legacy,reviews_verified:true,total_resenas:2}).reviews,2);
 const c=clientFor(null,{data:[],error:null});assert.deepEqual(await createMeryoApi(c).catalog(),[]);
 assert.deepEqual(c.calls,[{name:'meryo_catalogo_categoria',args:{p_categoria:'barberia'}}]);
 await assert.rejects(createMeryoApi(clientFor(null,{data:null,error:{message:'Unavailable'}})).catalog(),/Unavailable/);
});
test('no identity fallback: local private operations never send a request',async()=>{
 let sent=0;const api=createMeryoApi(createLocalClient(async()=>{sent++;throw Error('unexpected');}));
 await assert.rejects(api.request({}),/Auth de pruebas/);await assert.rejects(api.respond('id',true),/Auth de pruebas/);await assert.rejects(api.registerShop({}),/Auth de pruebas/);await assert.rejects(api.bookings(),/Auth de pruebas/);assert.equal(sent,0);
});
test('administrator role must belong to the authenticated subject and an active profile',async()=>{
 for(const profile of [{id:'another-user',rol:'admin',activo:true},{id:'real-subject',rol:'admin',activo:false},{id:'real-subject',rol:'invented',activo:true}])await assert.rejects(verifiedProfile(clientFor(profile)),/autorizado/);
 assert.equal((await verifiedProfile(clientFor({id:'real-subject',rol:'admin',activo:true}))).rol,'admin');
});
test('request maps service ID and timestamp to public RPC and never invokes a payment',async()=>{
 const c=clientFor({id:'real-subject',rol:'cliente',activo:true});const api=createMeryoApi(c);
 assert.equal(await api.request({shop:15,service:7,start:'2026-11-01T15:00:00Z',name:' Ana ',phone:'999999999',note:'Fade',extra:5}),'saved-id');
 assert.deepEqual(c.calls.find(x=>x.name==='crear_reserva'),{name:'crear_reserva',args:{p_barberia_id:15,p_servicio_id:7,p_inicio:'2026-11-01T15:00:00Z',p_nombre:'Ana',p_telefono:'999999999',p_pedido:'Fade',p_extra:0}});
 assert.ok(!c.calls.some(x=>/pago|payment/.test(x.name??'')));
});
test('beauty promotion booking validates the server offer and sends both expected prices',async()=>{
 const c=clientFor({id:'real-subject',rol:'cliente',activo:true}),api=createMeryoApi(c);
 const campaign='e3987269-8777-4b66-8b65-d9e3a2c9ef01';
 assert.equal(await api.request({shop:15,service:7,barber:'6e648bbb-b222-4ee0-a18d-3db1cb7e9da1',start:'2026-11-08T15:00:00Z',name:' Ana ',phone:'999999999',salonPromotionId:campaign,salonRegularPrice:80,salonPromoPrice:50}), 'saved-id');
 const call=c.calls.find(x=>x.name==='meryo_solicitar_cita');
 assert.deepEqual(call.args,{p_barberia_id:15,p_servicio_id:7,p_inicio:'2026-11-08T15:00:00Z',p_nombre:'Ana',p_telefono:'999999999',p_pedido:null,p_extra:0,p_barbero_id:'6e648bbb-b222-4ee0-a18d-3db1cb7e9da1',p_campaign_id:null,p_precio_habitual:null,p_beauty_campaign_id:campaign,p_beauty_regular_price:80,p_beauty_expected_price:50});
 assert.ok(!c.calls.some(x=>/pago|payment/.test(x.name??'')));
});
test('beauty regular-price fallback is still checked by the server without a campaign ID',async()=>{
 const c=clientFor({id:'real-subject',rol:'cliente',activo:true}),api=createMeryoApi(c);
 await api.request({shop:15,service:7,barber:'6e648bbb-b222-4ee0-a18d-3db1cb7e9da1',start:'2026-11-08T15:00:00Z',name:'Ana',phone:'999999999',salonRegularPrice:80});
 const call=c.calls.find(x=>x.name==='meryo_solicitar_cita');
 assert.equal(call.args.p_beauty_campaign_id,null);assert.equal(call.args.p_beauty_regular_price,80);assert.equal(call.args.p_beauty_expected_price,null);
});
test('finder reservation uses the current server RPC with an expected regular-price snapshot',async()=>{
 const c=clientFor({id:'real-subject',rol:'cliente',activo:true}),api=createMeryoApi(c);
 await api.request({shop:15,service:7,barber:'6e648bbb-b222-4ee0-a18d-3db1cb7e9da1',start:'2026-11-10T22:30:00Z',name:'Ana',phone:'999999999',finderExpectedPrice:35});
 const call=c.calls.find(x=>x.name==='meryo_solicitar_cita');
 assert.deepEqual(call.args,{p_barberia_id:15,p_servicio_id:7,p_inicio:'2026-11-10T22:30:00Z',p_nombre:'Ana',p_telefono:'999999999',p_pedido:null,p_extra:0,p_barbero_id:'6e648bbb-b222-4ee0-a18d-3db1cb7e9da1',p_campaign_id:null,p_precio_habitual:null,p_beauty_campaign_id:null,p_beauty_regular_price:null,p_beauty_expected_price:null,p_precio_esperado:35});
});
test('inspiration request sends the stable publication ID and expected regular price to the server wrapper',async()=>{
 const c=clientFor({id:'real-subject',rol:'cliente',activo:true}),api=createMeryoApi(c),publication='7b83d420-1144-48be-9c1d-5cf81e547311';
 await api.request({shop:15,service:7,barber:'6e648bbb-b222-4ee0-a18d-3db1cb7e9da1',start:'2026-11-12T20:00:00Z',name:'Ana',phone:'999999999',inspirationPublicationId:publication,inspirationExpectedPrice:85,salonRegularPrice:85});
 const call=c.calls.find(x=>x.name==='meryo_solicitar_cita');
 assert.deepEqual(call.args,{p_barberia_id:15,p_servicio_id:7,p_inicio:'2026-11-12T20:00:00Z',p_nombre:'Ana',p_telefono:'999999999',p_pedido:null,p_extra:0,p_barbero_id:'6e648bbb-b222-4ee0-a18d-3db1cb7e9da1',p_campaign_id:null,p_precio_habitual:null,p_beauty_campaign_id:null,p_beauty_regular_price:null,p_beauty_expected_price:null,p_precio_esperado:85,p_inspiration_publication_id:publication});
 assert.ok(!c.calls.some(x=>/pago|payment/.test(x.name??'')));
});
test('catalog exposes an offer only when its price is below the regular service price',()=>{
 const shop=mapShop({id:9,nombre:'Salón',tipos_negocio:['belleza'],servicios:[
  {id:4,nombre:'Peinado',activo:true,categoria:'peinados',requiere_evaluacion:false,precio:80,duracion_min:60,promocion_belleza:{id:'offer-id',precio:50,desde:'2026-11-01',hasta:'2026-11-08'}},
  {id:5,nombre:'Coloración',activo:true,categoria:'coloracion',requiere_evaluacion:false,precio:80,duracion_min:90,promocion_belleza:{id:'invalid-offer',precio:80,desde:'2026-11-01',hasta:'2026-11-08'}},
 ]});
 assert.deepEqual(shop.services.map(service=>service.beautyPromotion?.id||null),['offer-id',null]);
 assert.equal(shop.services[0].beautyPromotion.regularPrice,80);assert.equal(shop.services[0].beautyPromotion.promoPrice,50);
});
test('failed and empty RPC responses do not become saved requests',async()=>{
 for(const answer of [{data:null,error:{message:'Horario ocupado'}},{data:null,error:null}]){
 const api=createMeryoApi(clientFor({id:'real-subject',rol:'cliente',activo:true},answer));await assert.rejects(api.request({shop:1,service:2,start:'x',name:'A',phone:'999999999'}));}
});

test('an older backend cannot receive a request with obsolete rules',async()=>{
 const c=clientFor({id:'real-subject',rol:'cliente',activo:true});
 const rpc=c.rpc;c.rpc=(name,args)=>name==='meryo_reservas_config'?Promise.resolve({data:{respuesta_segundos:300,modelo_comercial:'comision'},error:null}):rpc(name,args);
 await assert.rejects(createMeryoApi(c).request({shop:1,service:1,start:'x',name:'Ana',phone:'999999999'}),/actualizado/);
 assert.ok(!c.calls.some(call=>call.name==='crear_reserva'));
});
test('barber response preserves expired result; client cannot respond',async()=>{
 const api=createMeryoApi(clientFor({id:'real-subject',rol:'barbero',barberia_id:42,activo:true},{data:'expirada',error:null}));assert.equal(await api.respond('booking',true),'expirada');
 const c=clientFor({id:'real-subject',rol:'cliente',activo:true});await assert.rejects(createMeryoApi(c).respond('booking',true));assert.ok(!c.calls.some(x=>x.name));
});
test('no-show uses the existing attendance RPC and is restricted to an active barber account',async()=>{
 const c=clientFor({id:'real-subject',rol:'barbero',barberia_id:42,activo:true},{data:null,error:null}),api=createMeryoApi(c);
 assert.equal(await api.markNoShow('booking-id'),true);
 assert.deepEqual(c.calls.find(x=>x.name==='marcar_asistencia'),{name:'marcar_asistencia',args:{p_reserva_id:'booking-id',p_asistio:false}});
 const failure=clientFor({id:'real-subject',rol:'barbero',barberia_id:42,activo:true},{data:null,error:{message:'Esperar 15 minutos'}});
 await assert.rejects(createMeryoApi(failure).markNoShow('booking-id'),/Esperar 15 minutos/);
 const customer=clientFor({id:'real-subject',rol:'cliente',activo:true});
 await assert.rejects(createMeryoApi(customer).markNoShow('booking-id'),/rol correspondiente/);
 assert.ok(!customer.calls.some(x=>x.name==='marcar_asistencia'));
});
test('arrival registration reuses the authenticated appointment API and rejects other roles',async()=>{
 const c=clientFor({id:'real-subject',rol:'barbero',barberia_id:42,activo:true},{data:'2026-11-08T10:00:00Z',error:null}),api=createMeryoApi(c);
 assert.equal(await api.markArrival('booking-id'),'2026-11-08T10:00:00Z');
 assert.deepEqual(c.calls.find(x=>x.name==='marcar_llegada'),{name:'marcar_llegada',args:{p_reserva_id:'booking-id'}});
 const failure=clientFor({id:'real-subject',rol:'cliente',activo:true});
 await assert.rejects(createMeryoApi(failure).markArrival('booking-id'),/rol correspondiente/);
 assert.ok(!failure.calls.some(x=>x.name==='marcar_llegada'));
});
test('finalizing a booking reuses marcar_asistencia with attended=true and never calls payment APIs',async()=>{
 const c=clientFor({id:'real-subject',rol:'barbero',barberia_id:42,activo:true}),api=createMeryoApi(c);
 assert.equal(await api.finishBooking('booking-id'),true);
 assert.deepEqual(c.calls.find(x=>x.name==='marcar_asistencia'),{name:'marcar_asistencia',args:{p_reserva_id:'booking-id',p_asistio:true}});
 assert.ok(!c.calls.some(x=>/pago|charge|checkout/i.test(x.name||'')));
 const customer=clientFor({id:'real-subject',rol:'cliente',activo:true});
 await assert.rejects(createMeryoApi(customer).finishBooking('booking-id'),/rol correspondiente/);
 assert.ok(!customer.calls.some(x=>x.name==='marcar_asistencia'));
});
test('Mis citas filters by authenticated customer or assigned shop',async()=>{
 for(const p of [{id:'real-subject',rol:'cliente',activo:true},{id:'real-subject',rol:'barbero',barberia_id:42,activo:true}]){
 const c=clientFor(p);await createMeryoApi(c).bookings();assert.deepEqual(c.calls.find(x=>x.table==='reservas').filters,[[p.rol==='barbero'?'barberia_id':'cliente_id',p.rol==='barbero'?42:'real-subject']]);}
});
test('business registration supports categories through the existing authenticated owner RPC',async()=>{
 for(const category of ['barberia','belleza','ambos']){
  const c=clientFor({id:'real-subject',rol:'cliente',activo:true});await createMeryoApi(c).registerShop({nombre:' MERYO ',distrito:'Ate',direccion:'Calle 1',lat:'-12',lng:'-77',tipo_negocio:category});
  const call=c.calls.find(x=>x.name);assert.equal(call.name,'registrar_negocio');assert.equal(call.args.p_nombre,'MERYO');assert.equal(call.args.p_lat,-12);assert.equal(call.args.p_tipo_negocio,category);assert.ok(!('acepta_auto' in call.args));assert.ok(!('rol' in call.args));
 }
});
test('booking state delegates scope to the authenticated server RPC, not the visual catalog category',async()=>{
 const answer={data:{server_now:'2026-11-01T12:00:00Z',reservas:[]},error:null};
 for(const profile of [{id:'real-subject',rol:'cliente',activo:true},{id:'real-subject',rol:'barbero',barberia_id:42,activo:true}]){
  const c=clientFor(profile,answer),api=createMeryoApi(c);await api.bookingState();
  assert.deepEqual(c.calls.find(x=>x.name==='meryo_reservas_estado'),{name:'meryo_reservas_estado',args:undefined});
  assert.ok(!c.calls.some(x=>x.name==='meryo_reservas_estado'&&x.args?.p_categoria),'booking scope cannot come from the visual category');
 }
 const admin=clientFor({id:'real-subject',rol:'admin',activo:true},answer),api=createMeryoApi(admin);
 await assert.rejects(api.bookingState(),/rol correspondiente/);
 assert.ok(!admin.calls.some(x=>x.name==='meryo_reservas_estado'),'unrelated roles cannot query booking state');
});
test('evaluation-only services stay visible without a fabricated price and are not reservable',()=>{
 const mapped=mapShop({id:1,nombre:'Salón',tipos_negocio:['belleza'],servicios:[{id:4,nombre:'Tratamiento capilar',activo:true,categoria:'tratamientos_capilares',requiere_evaluacion:true,precio:null,duracion_min:null}]});
 assert.deepEqual(mapped.businessTypes,['belleza']);assert.equal(mapped.services[0].price,null);assert.equal(mapped.services[0].duration,null);assert.equal(mapped.services[0].bookable,false);assert.equal(mapped.services[0].category,'tratamientos_capilares');
});
test('simulation receipts never receive a real-payment confirmation label',()=>{
 assert.equal(bookingLabel({estado:'aceptada'}),'Aceptada · pendiente de pago');assert.match(bookingLabel({estado:'confirmada',pagos:[{proveedor:'localhost-fixture'}]}),/no acredita un cobro/);
});
