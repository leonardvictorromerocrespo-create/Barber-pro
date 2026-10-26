import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bookingAccounts} from './helpers/real-booking.mjs';

test('different real Auth clients cannot hold an overlapping time',
 {skip:process.env.MERYO_REAL_AUTH_TEST!=='1'},async()=>{
 const a=await bookingAccounts({customerFile:'cliente-flujo-tests.json'}),b=await bookingAccounts({customerFile:'cliente-concurrencia.json'});
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(Date.now()+2*86400000);
 const args={p_barberia_id:a.shop,p_servicio_id:a.service,p_inicio:`${date}T14:00:00-05:00`,p_nombre:'Concurrencia local',p_telefono:'999999999',p_extra:0};
 let winner;
 try{
  const results=await Promise.all([a.customer.rpc('crear_reserva',args),b.customer.rpc('crear_reserva',args)]);
  assert.equal(results.filter(r=>!r.error).length,1);const index=results.findIndex(r=>!r.error);winner={client:index===0?a.customer:b.customer,id:results[index].data};
  const outsider=index===0?b.customer:a.customer;
  const state=await outsider.rpc('meryo_reservas_estado');assert.ifError(state.error);assert.ok(!state.data.reservas.some(r=>r.id===winner.id),'RLS snapshot must hide another customer');
  assert.ok((await outsider.rpc('cancelar_reserva_cliente',{p_reserva_id:winner.id})).error);
 }finally{
  if(winner)await winner.client.rpc('cancelar_reserva_cliente',{p_reserva_id:winner.id});
  await a.close();await b.close();
 }
 });
