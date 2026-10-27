import {test} from 'node:test';import assert from 'node:assert/strict';import {bookingIdFromSearch,bookingDestination,bookingDeadline} from '../src/lib/booking-link.js';import {beginGoogle} from '../src/lib/booking-draft.js';
import vm from 'node:vm';import fs from 'node:fs/promises';
test('reservation destination wins over stale administrative navigation on OAuth',async()=>{
 const id='10000000-0000-0000-0000-000000000001';let request;
 await beginGoogle({auth:{signInWithOAuth:async r=>{request=r;return {};}}},{enabled:true,origin:'https://meryo.example',bookingId:id,adminView:'avisos'});
 const callback=new URL(request.options.redirectTo);assert.equal(callback.searchParams.get('cita'),id);assert.equal(callback.searchParams.has('admin_view'),false);assert.equal(bookingDestination(callback.search,'admin'),'my-bookings');
 assert.equal(bookingDestination('?cita=https://evil.example','client'),'client');assert.equal(bookingIdFromSearch('?cita='+id),id);
});
test('deadline follows current server state, not stale notification or prior response deadline',()=>{
 const row={estado:'aceptada',expira_respuesta_en:'old-response',expira_pago_en:'server-payment'};assert.equal(bookingDeadline(row),'server-payment');assert.equal(bookingDeadline({...row,estado:'solicitada'}),'old-response');for(const estado of ['expirada','cancelada_cliente','cancelada_barbero','rechazada','confirmada'])assert.equal(bookingDeadline({...row,estado}),null);
});
test('request and acceptance clicks open the same booking in an existing window without administrative destination',async()=>{
 const handlers={},shown=[],navigated=[];const self={location:{origin:'https://meryo.example'},addEventListener:(k,f)=>{handlers[k]=f;},registration:{showNotification:async(_title,o)=>shown.push(o)},clients:{matchAll:async()=>[{url:'https://meryo.example/?admin_view=avisos#admin',navigate:async url=>navigated.push(url),focus:async()=>{}}]}};
 vm.runInNewContext(await fs.readFile('public/meryo-push-sw.js','utf8'),{self,URL,Response,fetch:async()=>{}});
 for(const event of ['reserva_solicitada','reserva_aceptada']){let task;handlers.push({data:{json:()=>({event,bookingId:'10000000-0000-0000-0000-000000000001'})},waitUntil:p=>{task=p;}});await task;handlers.notificationclick({notification:{data:shown.at(-1).data,close(){}},waitUntil:p=>{task=p;}});await task;assert.equal(navigated.at(-1),'https://meryo.example/?cita=10000000-0000-0000-0000-000000000001#my-bookings');assert.doesNotMatch(navigated.at(-1),/admin|avisos/);}
});
