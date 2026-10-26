import {test} from 'node:test';
import assert from 'node:assert/strict';
import {secrets} from '../scripts/setup-real-auth.mjs';
import {bookingAccounts} from './helpers/real-booking.mjs';
test('a real signed access token cannot write after its Auth session is revoked',
 {skip:process.env.MERYO_REAL_AUTH_TEST!=='1'},async()=>{
 const a=await bookingAccounts({customerFile:'cliente-flujo-tests.json'}),{anonKey}=await secrets();
 try{
  const {data}=await a.customer.auth.getSession();const token=data.session.access_token;
  assert.equal((await a.customer.rpc('meryo_sesion_activa')).data,true);
  assert.ifError((await a.customer.auth.signOut({scope:'local'})).error);
  const rpc=async(name,body={})=>fetch('http://127.0.0.1:5178/__supabase/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:anonKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const state=await rpc('meryo_sesion_activa');assert.equal(await state.json(),false);
  const r=await rpc('crear_reserva',{p_barberia_id:a.shop,p_servicio_id:a.service,p_inicio:new Date(Date.now()+86400000).toISOString(),p_nombre:'Token revocado',p_telefono:'999999999',p_extra:0});
  assert.equal(r.status,403);assert.equal((await r.json()).code,'42501');
 }finally{await a.close();}
 });
