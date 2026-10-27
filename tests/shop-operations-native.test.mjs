import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';
import pg from 'pg';import {createClient} from '@supabase/supabase-js';
import {secrets,nativeRoot,realConfig} from '../scripts/setup-real-auth.mjs';
import {totp} from './helpers/totp.mjs';
test('native real Auth/PostgREST: owner preparation, MFA moderation, publication and review history',{skip:process.env.MERYO_REAL_AUTH_TEST!=='1'},async t=>{
 const {anonKey}=await secrets(),make=()=>createClient('http://127.0.0.1:5178/__supabase',anonKey,{auth:{persistSession:false,autoRefreshToken:false}}),db=new pg.Client(realConfig);
 await db.connect();const admin=make(),owner=make(),stranger=make(),anonymous=make();const credentials={};
 async function signup(client,label){const c={email:`${label}.${crypto.randomUUID()}@example.com`,password:crypto.randomBytes(24).toString('base64url')};const result=await client.auth.signUp(c);assert.ifError(result.error);assert.ok(result.data.session);credentials[label]={...c,id:result.data.user.id};return result.data.user.id;}
 const adminId=await signup(admin,'admin'),ownerId=await signup(owner,'owner');await signup(stranger,'stranger');
 // Controlled synthetic local fixture, with a real Auth user, signed JWT and TOTP.
 await db.query("update public.profiles set rol='admin',nombre='Admin de pruebas aisladas' where id=$1",[adminId]);
 let shop;
 try{
  await t.test('AAL1 admin cannot read administrative data or moderate',async()=>{assert.ok((await admin.rpc('meryo_admin_barberias')).error);assert.ok((await admin.rpc('meryo_moderar_barberia',{p_id:1,p_action:'aprobar',p_reason:'',p_expected:'pendiente'})).error);});
  const factor=await admin.auth.mfa.enroll({factorType:'totp',issuer:'MERYO prueba aislada',friendlyName:'Prueba automatizada aislada'});assert.ifError(factor.error);
  assert.ifError((await admin.auth.mfa.challengeAndVerify({factorId:factor.data.id,code:totp(factor.data.totp.secret)})).error);
  credentials.admin.factorId=factor.data.id;credentials.admin.totpSecret=factor.data.totp.secret;
  await t.test('owner registers and prepares private profile without granting approval',async()=>{
   const result=await owner.rpc('registrar_barberia',{p_nombre:'MERYO Operaciones Local',p_distrito:'Ate',p_direccion:'Dirección de pruebas aisladas',p_descripcion:'Perfil pendiente',p_lat:-12.04,p_lng:-77.03,p_whatsapp:null,p_correo:null});assert.ifError(result.error);shop=result.data;
   const row=(await owner.from('barberias').select('*').eq('id',shop).single()).data;
   assert.equal(row.estado,'pendiente');assert.equal(row.verificada,false);
   assert.ok(!(await anonymous.rpc('meryo_catalogo_publico')).data.some(b=>String(b.id)===String(shop)));
   assert.ok((await owner.from('barberias').update({nombre:'Bypass directo'}).eq('id',shop)).error);
   assert.ok((await owner.rpc('meryo_guardar_perfil',{p_data:{...row,verificada:true}})).error);
   assert.ok((await owner.rpc('meryo_moderar_barberia',{p_id:shop,p_action:'aprobar',p_reason:'',p_expected:'pendiente'})).error);
   assert.ok((await stranger.rpc('meryo_historial_barberia',{p_id:shop})).error);
  });
  await t.test('approval validates services; rejection requires reason and persists',async()=>{
   assert.ok((await admin.rpc('meryo_moderar_barberia',{p_id:shop,p_action:'aprobar',p_reason:'',p_expected:'pendiente'})).error);
   assert.ok((await admin.rpc('meryo_moderar_barberia',{p_id:shop,p_action:'rechazar',p_reason:'',p_expected:'pendiente'})).error);
   assert.ifError((await admin.rpc('meryo_moderar_barberia',{p_id:shop,p_action:'rechazar',p_reason:'Completar servicio para revisión',p_expected:'pendiente'})).error);
   assert.ifError((await owner.from('servicios').insert({barberia_id:shop,nombre:'Corte aislado',precio:30,duracion_min:30,activo:true})).error);
   assert.ok((await stranger.from('servicios').insert({barberia_id:shop,nombre:'Ajeno',precio:30,duracion_min:30})).error);
   assert.ifError((await admin.rpc('meryo_moderar_barberia',{p_id:shop,p_action:'aprobar',p_reason:'Servicio y ubicación revisados',p_expected:'rechazada'})).error);
   assert.ok((await anonymous.rpc('meryo_catalogo_publico')).data.some(b=>String(b.id)===String(shop)));
  });
  const profile={nombre:'MERYO Operaciones Local',distrito:'Ate',direccion:'Dirección de pruebas aisladas',descripcion:'Cambio público persistido',lat:-12.04,lng:-77.03,whatsapp:'999999999',correo_contacto:'local@example.com',disponible_ahora:true};
  await t.test('description updates publicly; identity changes require new review; suspension/reactivation persists',async()=>{
   assert.ifError((await owner.rpc('meryo_guardar_perfil',{p_data:profile})).error);
   assert.equal((await anonymous.rpc('meryo_catalogo_publico')).data.find(b=>String(b.id)===String(shop)).descripcion,profile.descripcion);
   assert.ifError((await owner.rpc('meryo_guardar_perfil',{p_data:{...profile,nombre:'MERYO Identidad Revisada Local'}})).error);
   assert.ok(!(await anonymous.rpc('meryo_catalogo_publico')).data.some(b=>String(b.id)===String(shop)));
   assert.ifError((await admin.rpc('meryo_moderar_barberia',{p_id:shop,p_action:'aprobar',p_reason:'Identidad revisada',p_expected:'pendiente'})).error);
   assert.ok((await admin.rpc('meryo_moderar_barberia',{p_id:shop,p_action:'suspender',p_reason:'Motivo válido',p_expected:'pendiente'})).error,'Optimistic state guard');
   for(const [action,expected] of [['suspender','activa'],['reactivar','suspendida']])assert.ifError((await admin.rpc('meryo_moderar_barberia',{p_id:shop,p_action:action,p_reason:'Revisión documentada',p_expected:expected})).error);
   const history=await owner.rpc('meryo_historial_barberia',{p_id:shop});assert.ifError(history.error);for(const action of ['registro','rechazar','aprobar','suspender','reactivar','actualizacion_perfil'])assert.ok(history.data.some(e=>e.action===action));
  });
  await t.test('Storage SQL policies only: pending objects private, cross-shop denied, retirement preserves objects',async()=>{
   const session=(await owner.auth.getSession()).data.session,claims=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url'));
   const object=`${shop}/${crypto.randomUUID()}.jpg`;
   await db.query('begin');try{
    await db.query('update meryo_private.shop_content_settings set uploads_enabled=true where id=1');
    await db.query("insert into storage.objects(bucket_id,name,owner_id,metadata) values('meryo-shop-content',$1,$2,$3)",[object,ownerId,JSON.stringify({size:100,mimetype:'image/jpeg'})]);
    await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims)]);await db.query('set local role authenticated');
    const asset=(await db.query("select public.meryo_publicar_archivo($1,'portada','SQL metadata only') id",[object])).rows[0].id;
    assert.ok(asset);await db.query('select public.meryo_retirar_archivo($1)',[asset]);
    await db.query('reset role');assert.equal((await db.query('select count(*)::integer n from storage.objects where name=$1',[object])).rows[0].n,1);
   }finally{await db.query('rollback');}
  });
  credentials.shop=shop;
  // Separate genuine local account reserved for the subsequent browser registration.
  const ui=make();await signup(ui,'uiowner');await ui.auth.signOut({scope:'local'});
  await fs.writeFile(path.join(nativeRoot,'shop-operations-accounts.json'),JSON.stringify(credentials),{mode:0o600});
 }finally{await Promise.all([admin,owner,stranger].map(c=>c.auth.signOut({scope:'local'})));await db.end();}
});
