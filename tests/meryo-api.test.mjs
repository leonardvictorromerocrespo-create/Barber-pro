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
 assert.deepEqual(c.calls,[{name:'meryo_catalogo_publico',args:undefined}]);
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
test('Mis citas filters by authenticated customer or assigned shop',async()=>{
 for(const p of [{id:'real-subject',rol:'cliente',activo:true},{id:'real-subject',rol:'barbero',barberia_id:42,activo:true}]){
 const c=clientFor(p);await createMeryoApi(c).bookings();assert.deepEqual(c.calls.find(x=>x.table==='reservas').filters,[[p.rol==='barbero'?'barberia_id':'cliente_id',p.rol==='barbero'?42:'real-subject']]);}
});
test('barber registration uses RPC without granting admin, auto acceptance or commercial rules',async()=>{
 const c=clientFor({id:'real-subject',rol:'cliente',activo:true});await createMeryoApi(c).registerShop({nombre:' MERYO ',distrito:'Ate',direccion:'Calle 1',lat:'-12',lng:'-77'});
 const call=c.calls.find(x=>x.name);assert.equal(call.name,'registrar_barberia');assert.equal(call.args.p_nombre,'MERYO');assert.equal(call.args.p_lat,-12);assert.ok(!('acepta_auto' in call.args));assert.ok(!('rol' in call.args));
});
test('simulation receipts never receive a real-payment confirmation label',()=>{
 assert.equal(bookingLabel({estado:'aceptada'}),'Aceptada · pendiente de pago');assert.match(bookingLabel({estado:'confirmada',pagos:[{proveedor:'localhost-fixture'}]}),/no acredita un cobro/);
});
