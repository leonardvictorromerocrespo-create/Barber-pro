import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import pg from 'pg';
import {createClient} from '@supabase/supabase-js';import {secrets,nativeRoot,realConfig} from '../scripts/setup-real-auth.mjs';
test('final team controls: atomic edit, foreign services, expired blocks and assigned response scope',{skip:process.env.MERYO_REAL_AUTH_TEST!=='1'},async()=>{
 const fixture=JSON.parse(await fs.readFile(path.join(nativeRoot,'team-scheduling-accounts.json'),'utf8')),{anonKey}=await secrets();
 const make=()=>createClient('http://127.0.0.1:5178/__supabase',anonKey,{auth:{persistSession:false,autoRefreshToken:false}}),owner=make(),staff=make(),db=new pg.Client(realConfig);await db.connect();
 try{
  for(const [c,who] of [[owner,'owner'],[staff,'staff']])assert.ifError((await c.auth.signInWithPassword(fixture[who])).error);
  const team=await owner.rpc('meryo_equipo');assert.ifError(team.error);const member=team.data.members.find(m=>m.id===fixture.member),work=member.hours.find(h=>h.kind==='jornada');assert.ok(work);
  assert.ifError((await owner.rpc('meryo_editar_tramo',{p_id:work.id,p_start:work.starts,p_end:work.ends})).error);
  assert.ok((await staff.rpc('meryo_editar_tramo',{p_id:work.id,p_start:'09:00',p_end:'18:00'})).error);
  assert.ok((await owner.rpc('meryo_editar_tramo',{p_id:work.id,p_start:'19:00',p_end:'09:00'})).error);
  const after=await owner.rpc('meryo_equipo');assert.equal(after.data.members.find(m=>m.id===member.id).hours.find(h=>h.id===work.id).ends,work.ends);
  const foreign=(await db.query('select id from public.servicios where barberia_id<>$1 limit 1',[fixture.shop])).rows[0];assert.ok(foreign);
  assert.ok((await owner.rpc('meryo_actualizar_integrante',{p_member:member.id,p_name:member.display_name,p_active:true,p_services:[foreign.id]})).error);
  assert.ok((await owner.rpc('meryo_agregar_bloqueo',{p_member:member.id,p_start:'2020-01-01T09:00:00-05:00',p_end:'2020-01-01T10:00:00-05:00',p_reason:'Fuera de plazo'})).error);
  const rows=await staff.rpc('meryo_reservas_estado');assert.ifError(rows.error);for(const row of rows.data.reservas??rows.data){assert.equal(typeof row.puede_responder,'boolean');if(row.barbero_id!==fixture.member)assert.equal(row.puede_responder,false);}
  const direct=await staff.from('reservas').update({estado:'confirmada'}).eq('id','00000000-0000-0000-0000-000000000000');assert.ok(direct.error,'Cannot confirm through a direct table update');
 }finally{await owner.auth.signOut();await staff.auth.signOut();await db.end();}
});
