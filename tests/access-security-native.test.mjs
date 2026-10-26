import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {nativeRoot,secrets} from '../scripts/setup-real-auth.mjs';
import {bookingAccounts} from './helpers/real-booking.mjs';
function totp(secret){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of secret.replaceAll('=','').toUpperCase())bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');
 const key=Buffer.from(bits.match(/.{8}/g).map(b=>parseInt(b,2))),counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
 const hmac=crypto.createHmac('sha1',key).update(counter).digest(),offset=hmac[19]&15;
 return String((hmac.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
test('real native MFA and ownership permissions, no role from user metadata',
 {skip:process.env.MERYO_REAL_AUTH_TEST!=='1'},async t=>{
 const {anonKey}=await secrets();const make=()=>createClient('http://127.0.0.1:5178/__supabase',anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const admin=make(),stranger=make(),a=await bookingAccounts({customerFile:'cliente-flujo-tests.json'});let factor;
 try{
  const access=await fs.readFile(path.join(nativeRoot,'acceso-admin-local.txt'),'utf8');
  const email=access.match(/Correo: (.+)/)[1].trim(),password=access.match(/Contraseña: (.+)/)[1].trim();
  assert.ifError((await admin.auth.signInWithPassword({email,password})).error);
  assert.equal((await admin.rpc('es_admin')).data,false);
  assert.ok((await admin.rpc('activar_barberia',{p_id:a.shop})).error,'Password alone never grants admin actions');
  const listed=await admin.auth.mfa.listFactors();assert.ifError(listed.error);
  if(listed.data.totp.length)throw Error('Existing user MFA must be verified by its owner; test will not alter it');
  await t.test('actual Auth TOTP enrollment, invalid code rejected, signed aal2 accepted',async()=>{
   const enrolled=await admin.auth.mfa.enroll({factorType:'totp',issuer:'MERYO Pruebas',friendlyName:'Verificacion automatizada local'});assert.ifError(enrolled.error);factor=enrolled.data.id;
   assert.ok((await admin.auth.mfa.challengeAndVerify({factorId:factor,code:'invalid'})).error);
   assert.ifError((await admin.auth.mfa.challengeAndVerify({factorId:factor,code:totp(enrolled.data.totp.secret)})).error);
   assert.equal((await admin.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,'aal2');
   const allowed=await admin.rpc('es_admin');assert.ifError(allowed.error);assert.equal(allowed.data,true);
   assert.ifError((await admin.rpc('activar_barberia',{p_id:a.shop})).error);
  });
  await t.test('Google-shaped untrusted metadata cannot grant admin; cross-shop writes denied',async()=>{
   const signup=await stranger.auth.signUp({email:`seguridad.${crypto.randomUUID()}@example.com`,password:crypto.randomBytes(24).toString('base64url'),options:{data:{rol:'admin',barberia_id:a.shop,full_name:'Cuenta de comprobacion'}}});assert.ifError(signup.error);
   const p=await stranger.from('profiles').select('*').eq('id',signup.data.user.id).single();assert.ifError(p.error);assert.equal(p.data.rol,'cliente');assert.equal(p.data.barberia_id,null);assert.equal(p.data.nombre,'Cuenta de comprobacion');
   assert.ok((await stranger.from('profiles').update({rol:'admin',barberia_id:a.shop}).eq('id',signup.data.user.id)).error);
   const second=await stranger.rpc('registrar_barberia',{p_nombre:'MERYO Seguridad Local',p_distrito:'Ate',p_direccion:'Prueba de aislamiento',p_descripcion:'Datos sinteticos',p_lat:-12.04,p_lng:-77.03,p_whatsapp:null,p_correo:null});assert.ifError(second.error);
   const hidden=await a.owner.from('barberias').select('id').eq('id',second.data);assert.ifError(hidden.error);assert.deepEqual(hidden.data,[]);
   const bad=await stranger.from('servicios').insert({barberia_id:a.shop,nombre:'No autorizado',precio:1,duracion_min:30});assert.ok(bad.error);
   const edited=await stranger.from('servicios').update({precio:1}).eq('id',a.service).select('id');assert.ok(edited.error||edited.data.length===0);
   assert.ok((await a.owner.from('barberias').update({verificada:true,acepta_auto:true}).eq('id',a.shop)).error);
  });
  await t.test('removed factor immediately revokes SQL admin capability even with old aal2 JWT',async()=>{
   assert.ifError((await admin.auth.mfa.unenroll({factorId:factor})).error);factor=null;
   assert.equal((await admin.rpc('es_admin')).data,false);
  });
 }finally{
  if(factor)await admin.auth.mfa.unenroll({factorId:factor});
  await admin.auth.signOut({scope:'local'});await stranger.auth.signOut({scope:'local'});await a.close();
 }
 });
