import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {secrets} from '../scripts/setup-real-auth.mjs';

// Opt-in integration check against the installed native services, never .env.
test('real local Auth: anonymous/client cannot approve or promote themselves',
 {skip:process.env.MERYO_REAL_AUTH_TEST!=='1'},async()=>{
  const {anonKey}=await secrets();
  const makeClient=()=>createClient('http://127.0.0.1:5178/__supabase',anonKey,{
   auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  });
  const anonymous=makeClient(),client=makeClient();
  const {data:shops,error:catalogError}=await anonymous.from('barberias').select('id,nombre,estado,verificada');
  assert.ifError(catalogError);
  const shop=shops.find(s=>s.nombre==='MERYO Prueba Local');
  assert.ok(shop,'Complete the UI walkthrough first');
  assert.equal(shop.estado,'activa');assert.equal(shop.verificada,true);
  assert.ok((await anonymous.rpc('activar_barberia',{p_id:shop.id})).error);
  const {data,error}=await client.auth.signUp({
   email:`permisos.${crypto.randomUUID()}@example.com`,password:crypto.randomBytes(24).toString('base64url'),
  });
  assert.ifError(error);assert.ok(data.session,'Requires local-only email autoconfirm');
  try{
   const {data:identity,error:userError}=await client.auth.getUser();assert.ifError(userError);
   assert.equal(identity.user.id,data.user.id);
   const {data:profile,error:profileError}=await client.from('profiles').select('id,rol,activo').eq('id',data.user.id).single();
   assert.ifError(profileError);assert.equal(profile.rol,'cliente');assert.equal(profile.activo,true);
   assert.ok((await client.rpc('activar_barberia',{p_id:shop.id})).error,'SQL must reject a genuine client JWT');
   assert.ok((await client.from('profiles').update({rol:'admin'}).eq('id',data.user.id)).error,'No self promotion');
   const {data:after,error:afterError}=await client.from('profiles').select('rol').eq('id',data.user.id).single();
   assert.ifError(afterError);assert.equal(after.rol,'cliente');
  }finally{await client.auth.signOut();}
 });
