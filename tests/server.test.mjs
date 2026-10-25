import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handlePaymentNotification} from '../server/payments.mjs';
import {resendSender,deliverOne} from '../server/notifications.mjs';

test('payment boundary verifies signature, then retrieves status before any database operation',async()=>{
 let calls=0;
 const db={query:async()=>{calls++;throw Error('unexpected database call');}};
 await assert.rejects(handlePaymentNotification({adapter:{verifyNotification:async()=>{throw Error('invalid signature');},retrievePayment:async()=>{throw Error('unexpected provider call');}},db}),/invalid signature/);
 assert.equal(calls,0);
 const adapter={verifyNotification:async()=>({paymentId:'p1'}),retrievePayment:async()=>({id:'p1',status:'pending'})};
 assert.deepEqual(await handlePaymentNotification({adapter,db}),{status:'not_confirmed'});assert.equal(calls,0);
 adapter.retrievePayment=async()=>({id:'other',status:'approved'});
 await assert.rejects(handlePaymentNotification({adapter,db}),/identity/);
 await assert.rejects(handlePaymentNotification({db}),/not configured/);
});
test('approved authoritative payment passes only validated values to the server RPC',async()=>{
 const queries=[];
 const db={query:async(sql,args)=>{queries.push({sql,args});return {rows:queries.length===1?[{id:'intent-1'}]:[{status:'confirmada'}]};}};
 const adapter={verifyNotification:async()=>({paymentId:'p1'}),retrievePayment:async()=>({id:'p1',status:'approved',provider:'provider',reference:'ref1',merchantId:'merchant1',amountCents:1500,currency:'PEN',live:false})};
 assert.deepEqual(await handlePaymentNotification({adapter,db}),{status:'confirmada'});
 assert.deepEqual(queries[1].args,['intent-1','provider','ref1','merchant1',1500,'PEN',false]);
});
test('external email adapter keeps stable idempotency key, rejects failures and stores no credentials in payload',async()=>{
 const requests=[];
 const send=resendSender({apiKey:'test-only',from:'test@example.invalid',appUrl:'https://example.invalid',fetchImpl:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({id:'message-1'})};}});
 const job={id:'outbox-1',email:'barber@example.invalid',event:'reserva_solicitada'};
 assert.equal(await send(job),'message-1');await send(job);
 assert.equal(requests[0].options.headers['Idempotency-Key'],requests[1].options.headers['Idempotency-Key']);
 assert.ok(!requests[0].options.body.includes('test-only'));
 assert.throws(()=>resendSender({apiKey:'x',from:'x',appUrl:'http://example.invalid'}),/HTTPS/);
});
test('worker retries failures and distinguishes provider acceptance from delivery',async()=>{
 const calls=[];const job={id:'one'};
 const queue={expire:async()=>calls.push('expire'),claim:async()=>job,accepted:async()=>calls.push('accepted'),failed:async()=>calls.push('failed')};
 assert.equal(await deliverOne({queue,send:async()=>{throw Error('private provider response');}}),'retry');
 assert.deepEqual(calls,['expire','failed']);calls.length=0;
 assert.equal(await deliverOne({queue,send:async()=> 'provider-id'}),'accepted');assert.deepEqual(calls,['expire','accepted']);
 queue.accepted=async()=>{throw Error('database unavailable');};
 await assert.rejects(deliverOne({queue,send:async()=> 'provider-id'}),/database unavailable/);
});
