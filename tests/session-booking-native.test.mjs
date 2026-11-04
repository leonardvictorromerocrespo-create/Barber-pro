import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import {nativeRoot,realConfig,secrets} from '../scripts/setup-real-auth.mjs';
import {createMeryoApi} from '../src/lib/meryo-api.js';
import {fechaLima,sumarDias} from '../src/lib/dates.js';

class MemoryStorage{
 #items=new Map();
 getItem(key){return this.#items.get(key)??null;}
 setItem(key,value){this.#items.set(key,String(value));}
 removeItem(key){this.#items.delete(key);}
}

test('one persistent client login survives app reload and supports consecutive booking requests',{skip:process.env.MERYO_REAL_AUTH_TEST!=='1'},async t=>{
 const fixture=JSON.parse(await fs.readFile(path.join(nativeRoot,'team-scheduling-accounts.json'),'utf8'));
 const {anonKey}=await secrets(),storage=new MemoryStorage(),clients=[],pool=new pg.Pool({...realConfig,max:1}),created=[];let signIns=0;
 const make=()=>{const client=createClient('http://127.0.0.1:5178/__supabase',anonKey,{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,storage}});clients.push(client);return client;};
 const first=make();
 assert.ifError((await first.auth.signInWithPassword(fixture.customerB)).error);signIns++;
 const second=make();
 const restored=await second.auth.getSession();assert.ifError(restored.error);assert.equal(restored.data.session.user.id,fixture.customerB.id);
 const api=createMeryoApi(second),owner=createClient('http://127.0.0.1:5178/__supabase',anonKey,{auth:{persistSession:false,autoRefreshToken:false}});clients.push(owner);
 assert.ifError((await owner.auth.signInWithPassword(fixture.owner)).error);
 const requestOnAvailableSlot=async(clientApi,offset)=>{
  for(let day=2;day<=12;day++){
   const date=sumarDias(fechaLima(new Date()),day);if(new Date(`${date}T12:00:00Z`).getUTCDay()===0)continue;
   const slots=await clientApi.slots(fixture.shop,fixture.service,date,fixture.member);
   const slot=slots.find(item=>!created.some(entry=>entry.date===date&&entry.time===item.time));
   if(!slot)continue;
   const id=await clientApi.request({shop:fixture.shop,service:fixture.service,barber:fixture.member,start:slot.time,name:'Cliente sesión persistente',phone:'999999999',note:`Prueba local consecutiva ${offset}`});
   created.push({id,date,time:slot.time});return id;
  }
  throw new Error('No hay horario sintético disponible para completar la prueba');
 };
 try{
  await t.test('the session restored after recreation can save two sequential requests without another sign-in',async()=>{
   const one=await requestOnAvailableSlot(api,1);
   const afterFirstReload=make();const afterFirstSession=await afterFirstReload.auth.getSession();assert.ifError(afterFirstSession.error);assert.equal(afterFirstSession.data.session.user.id,fixture.customerB.id);
   const two=await requestOnAvailableSlot(createMeryoApi(afterFirstReload),2);
   assert.notEqual(one,two);assert.equal(signIns,1);
   const bookings=await afterFirstReload.from('reservas').select('id').in('id',[one,two]);assert.ifError(bookings.error);assert.equal(bookings.data.length,2);
  });
 }finally{
  for(const booking of created)await owner.rpc('cancelar_reserva_barbero',{p_reserva_id:booking.id});
  await Promise.all(clients.map(client=>client.auth.signOut({scope:'local'})));
  await pool.end();
 }
});
