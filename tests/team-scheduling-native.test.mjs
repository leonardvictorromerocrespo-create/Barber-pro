import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import pg from 'pg';
import {createClient} from '@supabase/supabase-js';import {secrets,nativeRoot,realConfig} from '../scripts/setup-real-auth.mjs';import {fechaLima,sumarDias} from '../src/lib/dates.js';
test('team and individual agenda: genuine native accounts, invitation binding, privacy and concurrency',{skip:process.env.MERYO_REAL_AUTH_TEST!=='1'},async t=>{
 const {anonKey}=await secrets(),fixtures=JSON.parse(await fs.readFile(path.join(nativeRoot,'shop-operations-accounts.json'),'utf8'));
 const make=()=>createClient('http://127.0.0.1:5178/__supabase',anonKey,{auth:{persistSession:false,autoRefreshToken:false}}),owner=make(),staff=make(),a=make(),b=make(),anon=make();const db=new pg.Client(realConfig);await db.connect();
 const creds={owner:fixtures.owner},clients=[owner,staff,a,b],created=[];let failed=false;
 const sub=async(name,fn)=>t.test(name,{skip:failed?'Previous prerequisite failed':false},async()=>{try{await fn();}catch(e){failed=true;throw e;}});
 const signup=async(c,label)=>{const data={email:`team.${label}.${crypto.randomUUID()}@example.com`,password:crypto.randomBytes(24).toString('base64url')};const r=await c.auth.signUp(data);assert.ifError(r.error);creds[label]={...data,id:r.data.user.id};};
 assert.ifError((await owner.auth.signInWithPassword({email:fixtures.owner.email,password:fixtures.owner.password})).error);await signup(staff,'staff');await signup(a,'customerA');await signup(b,'customerB');
 const shop=fixtures.shop;const team=await owner.rpc('meryo_equipo');assert.ifError(team.error);const ownerMember=team.data.members.find(m=>m.propietario).id;
 const services=await owner.from('servicios').select('*').eq('barberia_id',shop).eq('activo',true);assert.ifError(services.error);const service=services.data[0].id;
 let member;const date=[2,3,4,5,6,7,8].map(n=>sumarDias(fechaLima(new Date()),n)).find(d=>new Date(d+'T12:00:00Z').getUTCDay()!==0),day=new Date(date+'T12:00:00Z').getUTCDay();
 const start=h=>`${date}T${String(h).padStart(2,'0')}:00:00-05:00`;
 const slots=async(id,svc=service)=>{const r=await anon.rpc('meryo_horarios_barbero',{p_shop:shop,p_service:svc,p_date:date,p_member:id});assert.ifError(r.error);return r.data;};
 const request=async(client,id,h)=>{const r=await client.rpc('meryo_solicitar_cita',{p_barberia_id:shop,p_servicio_id:service,p_inicio:typeof h==='string'?h:start(h),p_nombre:'Cliente de agenda aislada',p_telefono:'999999999',p_pedido:'Agenda individual en entorno aislado',p_extra:0,p_barbero_id:id});if(!r.error)created.push(r.data);return r;};
 try{
  await sub('owner invitation binds verified email, is single-use and cannot grant admin',async()=>{
   const invite=await owner.rpc('meryo_invitar_integrante',{p_email:creds.staff.email,p_name:'Barbero sintético'});assert.ifError(invite.error);
   assert.ok((await a.rpc('meryo_aceptar_invitacion',{p_token:invite.data.token})).error);
   const accepted=await staff.rpc('meryo_aceptar_invitacion',{p_token:invite.data.token});assert.ifError(accepted.error);member=accepted.data;
   assert.ok((await staff.rpc('meryo_aceptar_invitacion',{p_token:invite.data.token})).error);
   const p=await staff.from('profiles').select('*').eq('id',creds.staff.id).single();assert.ifError(p.error);assert.equal(p.data.rol,'barbero');assert.equal(String(p.data.barberia_id),String(shop));assert.equal((await staff.rpc('es_admin')).data,false);
   assert.ok((await staff.rpc('meryo_invitar_integrante',{p_email:creds.customerA.email,p_name:'No autorizado'})).error);
   assert.ok((await staff.rpc('meryo_guardar_perfil',{p_data:{nombre:'Intento ajeno'}})).error);
   assert.equal((await staff.rpc('meryo_equipo')).data.members.length,1);
  });
  await sub('service assignments, work windows, breaks and per-member blocks affect actual duration',async()=>{
   assert.ifError((await owner.rpc('meryo_actualizar_integrante',{p_member:member,p_name:'Barbero sintético',p_active:true,p_services:[service]})).error);
   assert.deepEqual(await slots(member),[],'No availability without an individual schedule');
   for(let d=0;d<7;d++)assert.ifError((await owner.rpc('meryo_agregar_tramo',{p_member:member,p_day:d,p_kind:'jornada',p_start:'09:00',p_end:'19:00'})).error);
   const pause=await owner.rpc('meryo_agregar_tramo',{p_member:member,p_day:day,p_kind:'descanso',p_start:'12:00',p_end:'13:00'});assert.ifError(pause.error);
   assert.ok(!(await slots(member)).some(s=>Date.parse(s.hora_inicio)===Date.parse(start(12))));
   const long=await owner.from('servicios').insert({barberia_id:shop,nombre:'Servicio largo individual',precio:50,duracion_min:75,activo:true}).select('id').single();assert.ifError(long.error);
   assert.ifError((await owner.rpc('meryo_actualizar_integrante',{p_member:member,p_name:'Barbero sintético',p_active:true,p_services:[service,long.data.id]})).error);
   assert.ok(!(await slots(member,long.data.id)).some(s=>Date.parse(s.hora_inicio)===Date.parse(start(11))),'Duration cannot cross a break');
   const block=await owner.rpc('meryo_agregar_bloqueo',{p_member:member,p_start:start(15),p_end:start(16),p_reason:'No laborable de pruebas'});assert.ifError(block.error);
   assert.ok(!(await slots(member)).some(s=>Date.parse(s.hora_inicio)===Date.parse(start(15))));assert.ok((await slots(ownerMember)).some(s=>Date.parse(s.hora_inicio)===Date.parse(start(15))));
   assert.ok((await staff.rpc('meryo_retirar_bloqueo',{p_id:block.data})).error);
   assert.ifError((await owner.rpc('meryo_retirar_bloqueo',{p_id:block.data})).error);assert.ok((await slots(member)).some(s=>Date.parse(s.hora_inicio)===Date.parse(start(15))));
   assert.equal((await db.query('select active from public.meryo_team_blocks where id=$1',[block.data])).rows[0].active,false);
  });
  await sub('two barbers can work concurrently; an employee sees/responds only to assigned appointments',async()=>{
   const staffSlots=await slots(member),common=(await slots(ownerMember)).find(s=>staffSlots.some(x=>x.hora_inicio===s.hora_inicio));assert.ok(common,'A free slot shared by both members');
   const r=await Promise.all([request(a,ownerMember,common.hora_inicio),request(b,member,common.hora_inicio)]);for(const result of r)assert.ifError(result.error);
   const ownerBooking=r[0].data,staffBooking=r[1].data;
   assert.ok((await staff.rpc('responder_reserva',{p_reserva_id:ownerBooking,p_aceptar:false})).error);
   const visible=await staff.rpc('meryo_reservas_estado');assert.ifError(visible.error);assert.ok(visible.data.reservas.some(x=>x.id===staffBooking));assert.ok(!visible.data.reservas.some(x=>x.id===ownerBooking));
   const raw=await staff.from('reservas').select('id').eq('id',ownerBooking);assert.ifError(raw.error);assert.deepEqual(raw.data,[]);
   const held=(await db.query('select * from public.reservas where id=$1',[staffBooking])).rows[0];assert.equal(held.barbero_id,member);assert.ok(Math.abs((Date.parse(held.expira_respuesta_en)-Date.parse(held.created_at))/1000-900)<2);
   assert.ok((await owner.rpc('meryo_agregar_bloqueo',{p_member:member,p_start:common.hora_inicio,p_end:new Date(Date.parse(common.hora_inicio)+60*60000).toISOString(),p_reason:'Afectaría cita'})).error);
   assert.ok((await owner.rpc('meryo_actualizar_integrante',{p_member:member,p_name:'Barbero sintético',p_active:false,p_services:[service]})).error);
   const accepted=await staff.rpc('responder_reserva',{p_reserva_id:staffBooking,p_aceptar:true});assert.ifError(accepted.error);assert.equal(accepted.data,'aceptada');
   const paymentWindow=(await db.query('select aceptada_en,expira_pago_en from public.reservas where id=$1',[staffBooking])).rows[0];assert.ok(Math.abs((Date.parse(paymentWindow.expira_pago_en)-Date.parse(paymentWindow.aceptada_en))/1000-600)<2);
   assert.ifError((await b.rpc('cancelar_reserva_cliente',{p_reserva_id:staffBooking})).error);assert.ifError((await owner.rpc('responder_reserva',{p_reserva_id:ownerBooking,p_aceptar:false})).error);
  });
  await sub('same-barber simultaneous requests yield exactly one hold; deactivation revokes access without deleting history',async()=>{
   const free=(await slots(member))[0];assert.ok(free);const results=await Promise.all([request(a,member,free.hora_inicio),request(b,member,free.hora_inicio)]);assert.equal(results.filter(r=>!r.error).length,1);const id=results.find(r=>!r.error).data;
   assert.ifError((await owner.rpc('responder_reserva',{p_reserva_id:id,p_aceptar:false})).error);
   assert.ifError((await owner.rpc('meryo_actualizar_integrante',{p_member:member,p_name:'Barbero sintético',p_active:false,p_services:[service]})).error);
   assert.deepEqual(await slots(member),[]);assert.ok((await staff.rpc('meryo_equipo')).error);
   assert.equal((await db.query('select count(*)::int n from public.reservas where barbero_id=$1',[member])).rows[0].n,2);
   assert.ifError((await owner.rpc('meryo_actualizar_integrante',{p_member:member,p_name:'Barbero sintético',p_active:true,p_services:[service]})).error);
  });
  if(!failed)await fs.writeFile(path.join(nativeRoot,'team-scheduling-accounts.json'),JSON.stringify({...creds,member,ownerMember,shop,service,date,completed:true},null,2),{mode:0o600});
 }finally{for(const id of created)await owner.rpc('cancelar_reserva_barbero',{p_reserva_id:id});await Promise.all(clients.map(c=>c.auth.signOut({scope:'local'})));await db.end();}
});
