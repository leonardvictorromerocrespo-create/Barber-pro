import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';
import {createClient} from '@supabase/supabase-js';import {secrets,nativeRoot} from '../scripts/setup-real-auth.mjs';
import {totp} from './helpers/totp.mjs';import {fechaLima,sumarDias} from '../src/lib/dates.js';
test('new admin records: real native sessions, MFA, filters, detail and reservation audit',{skip:process.env.MERYO_REAL_AUTH_TEST!=='1'},async t=>{
 const fixtures=JSON.parse(await fs.readFile(path.join(nativeRoot,'shop-operations-accounts.json'),'utf8')),{anonKey}=await secrets();
 const make=()=>createClient('http://127.0.0.1:5178/__supabase',anonKey,{auth:{persistSession:false,autoRefreshToken:false}}),admin=make(),owner=make(),client=make();
 for(const [c,f] of [[admin,fixtures.admin],[owner,fixtures.owner],[client,fixtures.stranger]])assert.ifError((await c.auth.signInWithPassword({email:f.email,password:f.password})).error);
 const from=sumarDias(fechaLima(new Date()),-1),to=sumarDias(fechaLima(new Date()),4);let booking;
 try{
  await t.test('all new endpoints reject AAL1 admin and nonadmin',async()=>{
   const calls=[['meryo_admin_usuarios',{}],['meryo_admin_reservas',{p_from:from,p_to:to}],['meryo_admin_resumen',{p_from:from,p_to:to}],['meryo_admin_reserva_detalle',{p_id:'00000000-0000-4000-8000-000000000000'}]];
   for(const c of [admin,owner,client])for(const [name,args] of calls)assert.ok((await c.rpc(name,args)).error);
  });
  assert.ifError((await admin.auth.mfa.challengeAndVerify({factorId:fixtures.admin.factorId,code:totp(fixtures.admin.totpSecret)})).error);
  await t.test('user search, ownership filter and bounded result exclude Auth secrets',async()=>{
   const r=await admin.rpc('meryo_admin_usuarios',{p_search:fixtures.owner.email,p_role:'propietario',p_active:'true'});assert.ifError(r.error);assert.equal(r.data.total,1);assert.equal(r.data.rows[0].id,fixtures.owner.id);assert.equal(r.data.rows[0].propietario,true);assert.ok(!JSON.stringify(r.data).includes('encrypted_password'));assert.ok((await admin.rpc('meryo_admin_usuarios',{p_offset:-1})).error);
  });
  await t.test('booking filters and detail use saved data; events record actual transitions without payments',async()=>{
   const services=await owner.from('servicios').select('id').eq('barberia_id',fixtures.shop).eq('activo',true);assert.ifError(services.error);const service=services.data[0].id;
   const slots=await client.rpc('horarios_disponibles',{p_barberia_id:fixtures.shop,p_servicio_id:service,p_fecha:sumarDias(fechaLima(new Date()),2)});assert.ifError(slots.error);assert.ok(slots.data.length);
   const created=await client.rpc('crear_reserva',{p_barberia_id:fixtures.shop,p_servicio_id:service,p_inicio:slots.data[0].hora_inicio,p_nombre:'Cliente de consulta aislada',p_telefono:'999999999',p_pedido:'Prueba administrativa aislada',p_extra:0});assert.ifError(created.error);booking=created.data;
   const page=await admin.rpc('meryo_admin_reservas',{p_from:from,p_to:to,p_shop:fixtures.shop,p_status:'solicitada',p_search:booking});assert.ifError(page.error);assert.equal(page.data.total,1);assert.equal(page.data.rows[0].id,booking);
   assert.ifError((await owner.rpc('responder_reserva',{p_reserva_id:booking,p_aceptar:false})).error);
   const detail=await admin.rpc('meryo_admin_reserva_detalle',{p_id:booking});assert.ifError(detail.error);assert.equal(detail.data.estado,'rechazada');assert.equal(detail.data.events.length,2);assert.equal(detail.data.events[0].after_data.estado,'solicitada');assert.equal(detail.data.events[1].after_data.estado,'rechazada');assert.deepEqual(detail.data.payments,[]);
   const summary=await admin.rpc('meryo_admin_resumen',{p_from:from,p_to:to});assert.ifError(summary.error);assert.equal(summary.data.cobros_habilitados,false);assert.equal(summary.data.ingresos_meryo,null);assert.ok(summary.data.reservas.rechazada>=1);assert.equal((await admin.rpc('meryo_admin_reservas',{p_from:to,p_to:from})).data,null);
  });
  await fs.writeFile(path.join(nativeRoot,'admin-records-proof.json'),JSON.stringify({at:new Date().toISOString(),booking,from,to,realAuth:true,realMfa:true,serverFilters:true,eventsVerified:true,noPayment:true}));
 }finally{await Promise.all([admin,owner,client].map(c=>c.auth.signOut({scope:'local'})));}
});
