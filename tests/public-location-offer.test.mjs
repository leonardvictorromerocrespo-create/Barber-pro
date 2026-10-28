import {test} from 'node:test';import assert from 'node:assert/strict';import {shopDirections} from '../src/lib/shop-directions.js';import {pushOfferDeferred,deferPushOffer,shouldOfferPush} from '../src/lib/push-offer.js';import {enableBookingPush} from '../src/lib/push.js';
test('directions use only the saved valid destination; no visitor origin or invented fallback',()=>{
 const u=new URL(shopDirections({lat:'-12.0464',lng:'-77.0428'}));assert.equal(u.origin,'https://www.google.com');assert.equal(u.pathname,'/maps/dir/');assert.equal(u.searchParams.get('api'),'1');assert.equal(u.searchParams.get('destination'),'-12.0464,-77.0428');assert.equal(u.searchParams.has('origin'),false);
 for(const p of [{},{lat:null,lng:null},{lat:'',lng:''},{lat:91,lng:0},{lat:'bad',lng:1}])assert.equal(shopDirections(p),null);
});
test('postponement is persistent per account and registered devices are not offered activation again',async()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};deferPushOffer(storage,'a');assert.equal(pushOfferDeferred(storage,'a'),true);assert.equal(pushOfferDeferred(storage,'b'),false);assert.equal(pushOfferDeferred(null,'a'),false);
 let reads=0;const api={pushDevice:async()=>{reads++;return true;}};assert.equal(await shouldOfferPush(api,{permission:'denied'}),false);assert.equal(await shouldOfferPush(api,{permission:'no compatible'}),false);assert.equal(reads,0);assert.equal(await shouldOfferPush(api,{permission:'default'}),true);assert.equal(await shouldOfferPush(api,{permission:'granted',subscribed:true,endpoint:'own'}),false);assert.equal(reads,1);
 assert.equal(await shouldOfferPush({pushDevice:async()=>false},{permission:'granted',subscribed:true,endpoint:'not-bound-to-this-account'}),true);
});
test('explicit activation asks official permission once, saves subscription, and never reports success on a save failure',async()=>{
 const originals=Object.fromEntries(['navigator','window','Notification'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));let prompts=0,subscriptions=0,saves=0,changes=0,subscription=null;
 const notification={permission:'default',requestPermission:async()=>{prompts++;notification.permission='granted';return 'granted';}},win=new EventTarget();win.PushManager=class{};win.Notification=notification;win.addEventListener('meryo-push-changed',()=>changes++);
 const worker={pushManager:{getSubscription:async()=>subscription,subscribe:async()=>{subscriptions++;subscription={toJSON:()=>({endpoint:'unit-only'})};return subscription;}}};
 try{
  Object.defineProperty(globalThis,'window',{value:win,configurable:true});Object.defineProperty(globalThis,'Notification',{value:notification,configurable:true});Object.defineProperty(globalThis,'navigator',{value:{serviceWorker:{register:async()=>worker,ready:Promise.resolve(worker)}},configurable:true});
  const config={push_disponible:true,push_public_key:'AA'},api={registerPush:async()=>{saves++;}};await enableBookingPush(api,config);assert.equal(prompts,1);assert.equal(saves,1);assert.equal(changes,1);await enableBookingPush(api,config);assert.equal(prompts,1);assert.equal(subscriptions,1);
  const before=changes;await assert.rejects(()=>enableBookingPush({registerPush:async()=>{throw Error('No se guardó');}},config),/No se guardó/);assert.equal(changes,before);notification.permission='denied';await assert.rejects(()=>enableBookingPush(api,config),/permiso está bloqueado/);assert.equal(prompts,1);
 }finally{for(const [key,d] of Object.entries(originals)){if(d)Object.defineProperty(globalThis,key,d);else delete globalThis[key];}}
});
