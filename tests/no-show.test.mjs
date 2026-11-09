import {test} from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';
import {noShowEligibility,showArrivalControl,showFinishControl,showNoShowControl} from '../src/lib/no-show.js';
import {deliverBookingPush} from '../server/web-push.mjs';

const startsAt=Date.parse('2026-11-08T10:00:00-05:00');
const paidBooking={estado:'confirmada',inicio:new Date(startsAt).toISOString(),pagada_en:'2026-11-08T10:05:00-05:00',pagos:[{estado:'pagado'}]};

test('no-show action requires confirmed state, a paid advance, and fifteen full minutes by server time',()=>{
 assert.deepEqual(noShowEligibility(paidBooking,startsAt+14*60_000+59_999),{eligible:false,reason:'plazo',eligibleAt:startsAt+15*60_000});
 assert.equal(noShowEligibility(paidBooking,startsAt+15*60_000).eligible,true);
 assert.equal(noShowEligibility({...paidBooking,estado:'completada'},startsAt+60*60_000).reason,'estado');
 assert.equal(noShowEligibility({...paidBooking,estado:'aceptada'},startsAt+60*60_000).reason,'estado');
 assert.equal(noShowEligibility({...paidBooking,pagada_en:null},startsAt+60*60_000).reason,'adelanto');
 assert.equal(noShowEligibility({...paidBooking,pagos:[{estado:'pendiente'}]},startsAt+60*60_000).reason,'adelanto');
 assert.equal(noShowEligibility({...paidBooking,llegada_en:new Date(startsAt+5*60_000).toISOString()},startsAt+60*60_000).reason,'llegada');
 assert.equal(noShowEligibility(paidBooking,null).reason,'hora');
});

test('arrival and no-show actions appear only in the assigned professional agenda and arrival hides no-show',()=>{
 const barber={id:'barber-account',rol:'barbero'},customer={id:'client',rol:'cliente'};
 assert.equal(showArrivalControl({...paidBooking,barbero_id:'member-a'},barber,'member-a'),true);
 assert.equal(showArrivalControl({...paidBooking,barbero_id:'member-a',inicio:new Date(startsAt+5*60_000).toISOString()},barber,'member-a'),true,'The professional can register a waiting client before the appointment starts');
 assert.equal(showArrivalControl({...paidBooking,barbero_id:'member-a',llegada_en:startsAt},barber,'member-a'),false);
 assert.equal(showArrivalControl({...paidBooking,barbero_id:'member-b'},barber,'member-a'),false);
 assert.equal(showArrivalControl({...paidBooking,barbero_id:'member-a'},customer,'member-a'),false);
 assert.equal(showFinishControl({...paidBooking,barbero_id:'member-a'},barber,'member-a'),false,'Finalization waits until arrival is recorded');
 assert.equal(showFinishControl({...paidBooking,barbero_id:'member-a',llegada_en:startsAt},barber,'member-a'),true);
 assert.equal(showFinishControl({...paidBooking,barbero_id:'member-b',llegada_en:startsAt},barber,'member-a'),false);
 assert.equal(showFinishControl({...paidBooking,barbero_id:'member-a',llegada_en:startsAt},customer,'member-a'),false);
 assert.equal(showFinishControl({...paidBooking,barbero_id:'member-a',llegada_en:startsAt,estado:'completada'},barber,'member-a'),false);
 assert.equal(showNoShowControl({...paidBooking,barbero_id:'member-a'},barber,'member-a'),true);
 assert.equal(showNoShowControl({...paidBooking,barbero_id:'member-a',llegada_en:startsAt},barber,'member-a'),false);
 assert.equal(showNoShowControl({...paidBooking,barbero_id:'member-b'},barber,'member-a'),false);
 assert.equal(showNoShowControl({...paidBooking,barbero_id:'member-a'},barber,null),false);
 assert.equal(showNoShowControl({...paidBooking,barbero_id:'member-a'},customer,'member-a'),false);
 assert.equal(showNoShowControl({...paidBooking,barbero_id:'member-a',estado:'completada'},barber,'member-a'),false);
});

test('existing push worker delivers the no-show notice only to the reservation customer',async()=>{
 const bookingId='10000000-0000-0000-0000-000000000001',notificationId=17,customerId='20000000-0000-0000-0000-000000000001';
 const keys=webpush.generateVAPIDKeys(),sent=[];let next=0;const job={id:5,notification_id:notificationId,user_id:customerId,event:'reserva_no_asistio',reserva_id:bookingId,pedido_id:null,attempts:1};
 const pool={async query(sql){
  if(sql.includes('with picked as')){assert.match(sql,/reserva_no_asistio/);assert.match(sql,/o\.user_id=r\.cliente_id/);return {rows:[job]};}
  if(sql.startsWith('select case when'))return {rows:[{seconds:'900'}]};
  if(sql.startsWith('select * from meryo_private.push_subscriptions'))return {rows:[{endpoint:'https://fcm.googleapis.com/test-no-show',p256dh:keys.publicKey,auth:Buffer.alloc(16,1).toString('base64url')}]};
  if(sql.startsWith('insert into meryo_private.push_deliveries'))return {rows:[{id:'30000000-0000-0000-0000-000000000001'}]};
  next++;return {rows:[]};
 }};
 const result=await deliverBookingPush(pool,{publicKey:keys.publicKey,privateKey:keys.privateKey,subject:'mailto:test@example.com'},{send:async(_subscription,payload,options)=>sent.push({body:JSON.parse(payload),options})});
 assert.equal(result,'provider_accepted');assert.equal(sent.length,1);
 assert.equal(sent[0].body.event,'reserva_no_asistio');assert.equal(sent[0].body.bookingId,bookingId);
 assert.match(sent[0].body.body,/adelanto pagado queda para la barbería; no se generó otro cobro/i);
 assert.equal(sent[0].options.TTL,900);assert.ok(next>=2);
});
