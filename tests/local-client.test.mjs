import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLocalClient,isLoopbackHost} from '../src/lib/local-client.js';
test('local UI facade never delegates Auth or mutations to a remote service',async()=>{
 const requests=[];
 const client=createLocalClient(async(...args)=>{requests.push(args);return {ok:true,json:async()=>[{id:900001,verificada:true}]};});
 assert.equal((await client.auth.getSession()).data.session,null);
 for(const operation of [client.auth.signInWithPassword({email:'synthetic',password:'synthetic'}),client.auth.signUp({}),client.from('barberias').insert({}).select(),client.from('profiles').update({rol:'admin'}),client.rpc('crear_reserva',{}),client.schema('meryo').rpc('request_booking',{}),client.from('reservas').select('*')]){
   assert.equal((await operation).error.code,'LOCAL_ONLY');
 }
 assert.equal(requests.length,0);
 assert.deepEqual((await client.from('barberias').select('*').eq('verificada',true)).data,[{id:900001,verificada:true}]);
 assert.deepEqual(requests[0],['/__local/catalog',{redirect:'error'}]);
 assert.equal(isLoopbackHost('localhost'),true);assert.equal(isLoopbackHost('127.0.0.1'),true);assert.equal(isLoopbackHost('production.example'),false);
});

test('local UI facade permits only the anonymous read for today’s public beauty offers',async()=>{
 const requests=[];
 const client=createLocalClient(async(...args)=>{requests.push(args);return {ok:true,json:async()=>[]};},'local-anon-key');
 assert.deepEqual((await client.rpc('meryo_belleza_promociones_hoy')).data,[]);
 assert.equal(requests.length,1);
 assert.equal(requests[0][0],'/__supabase/rest/v1/rpc/meryo_belleza_promociones_hoy');
 assert.equal(requests[0][1].method,'POST');
 assert.equal(requests[0][1].headers.apikey,'local-anon-key');
 assert.equal((await client.rpc('meryo_guardar_promocion_belleza',{})).error.code,'LOCAL_ONLY');
 assert.equal(requests.length,1,'No write or owner RPC is sent from the local facade');
});
