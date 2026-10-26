import {test} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {bookingAccounts} from './helpers/real-booking.mjs';

test('native Auth/PostgREST: manual 15 minute requests, locks and payment gate',
 {skip:process.env.MERYO_REAL_AUTH_TEST!=='1'},async t=>{
 const a=await bookingAccounts({customerFile:'cliente-flujo-tests.json'});
 const db=new pg.Client({host:'127.0.0.1',port:55440,user:'meryo_test_admin',database:'meryo_auth_local',ssl:false});
 await db.connect();
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(Date.now()+2*86400000);
 const start=hour=>`${date}T${String(hour).padStart(2,'0')}:00:00-05:00`;
 const request=(hour,extra=0)=>a.customer.rpc('crear_reserva',{p_barberia_id:a.shop,p_servicio_id:a.service,p_inicio:start(hour),p_nombre:'Cliente de pruebas',p_telefono:'999999999',p_pedido:'Pedido como texto, sin recargo',p_extra:extra});
 const decide=(id,accept)=>a.owner.rpc('responder_reserva',{p_reserva_id:id,p_aceptar:accept});
 const row=async id=>(await db.query('select * from public.reservas where id=$1',[id])).rows[0];
 const available=async hour=>{const r=await a.customer.rpc('horarios_disponibles',{p_barberia_id:a.shop,p_servicio_id:a.service,p_fecha:date});assert.ifError(r.error);return r.data.some(s=>Date.parse(s.hora_inicio)===Date.parse(start(hour)));};
 const created=[];
 try{
  await t.test('configuration is monthly, no fee or invented payment deadline; extras rejected',async()=>{
   const {data,error}=await a.customer.rpc('meryo_reservas_config');assert.ifError(error);
   assert.equal(data.respuesta_segundos,900);assert.equal(data.plazo_pago_segundos,null);assert.equal(data.modelo_comercial,'mensualidad');assert.equal(data.comision_por_corte,0);assert.equal(data.cobros_habilitados,false);assert.equal(data.push_disponible,false);
   assert.ok((await request(9,5)).error);
  });
  let accepted;
  await t.test('simultaneous requests get exactly one hold; real client cannot accept',async()=>{
   const results=await Promise.all([request(10),request(10)]);
   assert.equal(results.filter(r=>!r.error).length,1);
   accepted=results.find(r=>!r.error).data;created.push(accepted);
   const r=await row(accepted);assert.equal(r.estado,'solicitada');
   assert.ok(Math.abs((Date.parse(r.expira_respuesta_en)-Date.parse(r.created_at))/1000-900)<2);
   assert.equal(Number(r.extra_personalizacion),0);assert.equal(Number(r.precio_total),30);assert.equal(Number(r.monto_adelanto),15);
   assert.equal(await available(10),false);
   assert.ok((await a.customer.rpc('responder_reserva',{p_reserva_id:accepted,p_aceptar:true})).error);
   const state=await a.customer.rpc('meryo_reservas_estado');assert.ifError(state.error);assert.ok(Number.isFinite(Date.parse(state.data.server_now)));assert.ok(state.data.reservas.some(r=>r.id===accepted));
  });
  await t.test('manual acceptance retains hold; no browser payment confirmation',async()=>{
   const result=await decide(accepted,true);assert.ifError(result.error);assert.equal(result.data,'aceptada');
   const r=await row(accepted);assert.equal(r.expira_pago_en,null);assert.equal(r.estado,'aceptada');assert.equal(await available(10),false);
   assert.ok((await a.customer.from('reservas').update({estado:'confirmada'}).eq('id',accepted)).error);
   assert.ok((await a.customer.rpc('pagar_reserva_prueba',{p_reserva_id:accepted,p_metodo:'yape'})).error);
   assert.ok((await a.customer.rpc('confirmar_pago_reserva',{p_reserva_id:accepted,p_proveedor:'fake',p_ref:'fake',p_metodo:'yape'})).error);
   assert.equal((await row(accepted)).estado,'aceptada');
  });
  await t.test('rejection releases availability and records the client notification',async()=>{
   const r=await request(11);assert.ifError(r.error);created.push(r.data);
   const result=await decide(r.data,false);assert.ifError(result.error);assert.equal(result.data,'rechazada');assert.equal(await available(11),true);
   assert.equal((await db.query("select count(*)::int n from public.notificaciones where reserva_id=$1 and tipo='reserva_rechazada'",[r.data])).rows[0].n,1);
  });
  await t.test('server worker expires unattended requests without a browser call',async()=>{
   const r=await request(12);assert.ifError(r.error);created.push(r.data);
   await db.query("update public.reservas set expira_respuesta_en=clock_timestamp()-interval '1 second' where id=$1",[r.data]);
   for(let i=0;i<30&&(await row(r.data)).estado!=='expirada';i++)await new Promise(resolve=>setTimeout(resolve,200));
   assert.equal((await row(r.data)).estado,'expirada');assert.equal(await available(12),true);
   assert.ok((await decide(r.data,true)).error,'An expired request cannot be revived');
  });
  await t.test('configurable payment window works when explicitly set; expiry does not confirm',async()=>{
   await db.query('update meryo_private.launch_settings set plazo_pago_segundos=120 where id=1');
   try{
    const r=await request(13);assert.ifError(r.error);created.push(r.data);const result=await decide(r.data,true);assert.ifError(result.error);
    const value=await row(r.data);assert.ok(Math.abs((Date.parse(value.expira_pago_en)-Date.parse(value.aceptada_en))/1000-120)<1);
    await db.query("update public.reservas set expira_pago_en=clock_timestamp()-interval '1 second' where id=$1",[r.data]);
    for(let i=0;i<30&&(await row(r.data)).estado!=='expirada';i++)await new Promise(resolve=>setTimeout(resolve,200));
    assert.equal((await row(r.data)).estado,'expirada');assert.equal(await available(13),true);
   }finally{await db.query('update meryo_private.launch_settings set plazo_pago_segundos=null where id=1');}
  });
  await t.test('push events queued transactionally; no delivery or payment is invented',async()=>{
   const events=(await db.query('select event,status from meryo_private.push_outbox where reserva_id=any($1::uuid[])',[created])).rows;
   assert.ok(events.some(e=>e.event==='reserva_solicitada'));assert.ok(events.some(e=>e.event==='reserva_aceptada'));assert.ok(events.some(e=>e.event==='reserva_rechazada'));assert.ok(events.some(e=>e.event==='reserva_expirada'));
   assert.ok(events.every(e=>e.status==='pending_provider'));
   assert.equal((await db.query('select count(*)::int n from public.pagos where reserva_id=any($1::uuid[])',[created])).rows[0].n,0);
   assert.ok((await a.customer.rpc('meryo_registrar_push',{p_subscription:{endpoint:'http://unsafe'}})).error);
  });
 }finally{
  // Keep all history; cancel only unpaid test holds so the demonstration stays usable.
  for(const id of created)await a.customer.rpc('cancelar_reserva_cliente',{p_reserva_id:id});
  await a.close();await db.end();
 }
 });
