import {test} from 'node:test';import assert from 'node:assert/strict';import {visiblePolling} from '../src/lib/visible-polling.js';
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
function environment(hidden=false){const document=new EventTarget(),window=new EventTarget();document.visibilityState=hidden?'hidden':'visible';let tick,interval,cleared=false;return {document,window,setInterval:(f,ms)=>{tick=f;interval=ms;return 1;},clearInterval:()=>{cleared=true;},tick:()=>tick(),get interval(){return interval;},get cleared(){return cleared;}};}
test('reads every 15 seconds only while visible and refreshes on return',async()=>{
 const env=environment(true);let calls=0;const p=visiblePolling(()=>calls++,env);await flush();assert.equal(calls,0);assert.equal(env.interval,15000);env.tick();await flush();assert.equal(calls,0);
 env.document.visibilityState='visible';env.document.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(calls,1);env.tick();await flush();assert.equal(calls,2);env.document.visibilityState='hidden';env.window.dispatchEvent(new Event('focus'));env.tick();await flush();assert.equal(calls,2);p.stop();assert.equal(env.cleared,true);
});
test('slow reads never overlap; a saved action coalesces one fresh read after the in-flight snapshot',async()=>{
 const env=environment();let calls=0,release;const p=visiblePolling(()=>{calls++;if(calls===1)return new Promise(r=>{release=r;});},env);await flush();assert.equal(calls,1);env.tick();env.tick();await flush();assert.equal(calls,1);
 const a=p.refresh(),b=p.refresh();assert.equal(a,b);release();await a;assert.equal(calls,2);p.stop();
});
test('unmounted screens do not perform queued reads or react to later focus',async()=>{
 const env=environment();let calls=0,release;const p=visiblePolling(()=>{calls++;return new Promise(r=>{release=r;});},env);await flush();const queued=p.refresh();p.stop();release();await queued;env.document.dispatchEvent(new Event('visibilitychange'));env.window.dispatchEvent(new Event('focus'));env.tick();await flush();assert.equal(calls,1);
});
