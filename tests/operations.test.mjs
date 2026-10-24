import {test} from 'node:test';
import assert from 'node:assert/strict';
import {savedOperation,endSession,commissionLabel,signInWithProfile} from '../src/lib/operations.js';
test('errors and zero affected rows never become visual success',async()=>{
 for(const response of [{error:{message:'Denied'}},{data:[]},{data:null}]){
  let success=false;
  await assert.rejects(async()=>{await savedOperation(async()=>response);success=true;});assert.equal(success,false);
 }
 assert.deepEqual(await savedOperation(async()=>({data:{id:'saved'}})),{id:'saved'});
});
test('logout clears local state only after Supabase confirms sign out',async()=>{
 let cleared=false;
 await assert.rejects(endSession({auth:{signOut:async()=>({error:new Error('offline')})}},()=>{cleared=true;}));
 assert.equal(cleared,false);
 await endSession({auth:{signOut:async()=>({error:null})}},()=>{cleared=true;});assert.equal(cleared,true);
});
test('commercial fee remains unset unless approved S/1 or S/2',()=>{
 assert.equal(commissionLabel(null),'Por definir');assert.equal(commissionLabel(500),'Por definir');
 assert.equal(commissionLabel(100),'S/ 1.00');assert.equal(commissionLabel(200),'S/ 2.00');
});
test('login rejects missing/inactive/wrong role/unassigned profiles after authenticating',async()=>{
 for(const profile of [null,{activo:false,rol:'cliente'},{activo:true,rol:'admin'},{activo:true,rol:'barbero'}]){
  let signedOut=false;
  const query={select(){return this;},eq(){return this;},async single(){return {data:profile};}};
  const client={auth:{signInWithPassword:async()=>({data:{user:{id:'test'}}}),signOut:async()=>{signedOut=true;return {};}},from:()=>query};
  await assert.rejects(signInWithProfile(client,{},['cliente','barbero']));assert.equal(signedOut,true);
 }
});
test('login returns active authorized profile only after verification',async()=>{
 const profile={activo:true,rol:'cliente'};
 const query={select(){return this;},eq(){return this;},async single(){return {data:profile};}};
 const client={auth:{signInWithPassword:async()=>({data:{user:{id:'test'}}})},from:()=>query};
 assert.equal(await signInWithProfile(client,{},['cliente']),profile);
});
