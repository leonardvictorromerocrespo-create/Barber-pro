import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import pg from 'pg';import {createClient} from '@supabase/supabase-js';
import {realConfig,nativeRoot,secrets} from '../scripts/setup-real-auth.mjs';import {createMeryoApi} from '../src/lib/meryo-api.js';import {bookingDeadline} from '../src/lib/booking-link.js';import {fechaLima,sumarDias} from '../src/lib/dates.js';
test('reservation link uses current RLS snapshot, assigned response and actual Auth without administrative MFA',{skip:process.env.MERYO_REAL_AUTH_TEST!=='1'},async()=>{
 assert.equal(realConfig.host,'127.0.0.1');
 const f=JSON.parse(await fs.readFile(path.join(nativeRoot,'team-scheduling-accounts.json'),'utf8')),old=JSON.parse(await fs.readFile(path.join(nativeRoot,'shop-operations-accounts.json'),'utf8')),{anonKey}=await secrets(),db=new pg.Client(realConfig),clients=[],ids=[];
 await db.connect();let complete=false;
 const login=async credentials=>{const c=createClient('http://127.0.0.1:5178/__supabase',anonKey,{auth:{persistSession:false,autoRefreshToken:false}});clients.push(c);assert.ifError((await c.auth.signInWithPassword(credentials)).error);return c;};
 const customer=await login(f.customerB),staff=await login(f.staff),owner=await login(f.owner),other=await login(old.stranger),a=createMeryoApi(customer),b=createMeryoApi(staff),foreign=createMeryoApi(other);
 const date=[2,3,4,5].map(n=>sumarDias(fechaLima(new Date()),n)).find(d=>new Date(d+'T12:00:00Z').getUTCDay()!==0);
 const request=async()=>{const slots=await a.slots(f.shop,f.service,date,f.member);assert.ok(slots.length);const id=await a.request({shop:f.shop,service:f.service,barber:f.member,start:slots[0].id,name:'Destino de aviso aislado',phone:'999999999',note:'Recorrido de enlace, sin envío push'});ids.push(id);return id;};
 const detail=async(api,id)=>(await api.bookingState()).reservas.find(r=>r.id===id);
 try{
  assert.equal((await customer.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,'aal1');assert.equal((await staff.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,'aal1');
  const accepted=await request();const pending=await detail(b,accepted);assert.equal(pending.puede_responder,true);assert.equal(pending.estado,'solicitada');assert.ok(Math.abs((Date.parse(bookingDeadline(pending))-Date.parse(pending.created_at))/1000-900)<2);
  assert.equal(await detail(foreign,accepted),undefined);assert.deepEqual((await other.from('reservas').select('id').eq('id',accepted)).data,[]);await assert.rejects(()=>foreign.respond(accepted,true));await assert.rejects(()=>a.respond(accepted,true));
  assert.equal(await b.respond(accepted,true),'aceptada');const ready=await detail(a,accepted);assert.equal(ready.estado,'aceptada');assert.ok(Math.abs((Date.parse(bookingDeadline(ready))-Date.parse(ready.aceptada_en))/1000-600)<2);assert.equal(Number(ready.monto_adelanto),Number(ready.precio_total)/2);assert.equal((await a.bookingConfig()).cobros_habilitados,false);
  const cancelled=await request();assert.ifError((await customer.rpc('cancelar_reserva_cliente',{p_reserva_id:cancelled})).error);assert.equal((await detail(a,cancelled)).estado,'cancelada_cliente');assert.equal(bookingDeadline(await detail(b,cancelled)),null);
  const expired=await request();await db.query("update public.reservas set expira_respuesta_en=clock_timestamp()-interval '1 second' where id=$1",[expired]);await db.query('select public.expirar_reservas_vencidas()');assert.equal((await detail(a,expired)).estado,'expirada');await assert.rejects(()=>b.respond(expired,true),/ya no esta pendiente/);
  const requested=await request();const anonymous=createClient('http://127.0.0.1:5178/__supabase',anonKey,{auth:{persistSession:false,autoRefreshToken:false}});assert.ok((await anonymous.rpc('meryo_reservas_estado')).error);
  // Reuse these isolated real bookings for UI verification, then cancel them when closing the block.
  await fs.writeFile(path.join(nativeRoot,'booking-link-proof.json'),JSON.stringify({at:new Date().toISOString(),accepted,requested,cancelled,expired,ids,customer:f.customerB,staff:f.staff,owner:f.owner},null,2));complete=true;
 }finally{if(!complete)for(const id of ids)await owner.rpc('cancelar_reserva_barbero',{p_reserva_id:id});for(const c of clients)await c.auth.signOut({scope:'local'});await db.end();}
});
