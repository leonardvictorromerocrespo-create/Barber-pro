import {test} from 'node:test';import assert from 'node:assert/strict';import {createNonStealingAuthLock} from '../src/lib/auth-lock.js';
test('Auth retains exclusive Web Locks without stealing another active session operation',async()=>{
 let chain=Promise.resolve(),active=0,max=0;const options=[];const locks={request:(_name,option,callback)=>{options.push(option);const task=chain.then(()=>callback({name:'auth-test'}));chain=task.catch(()=>{});return task;}};
 const lock=createNonStealingAuthLock(locks),operation=()=>lock('auth-test',100,async()=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,10));active--;});
 await Promise.all([operation(),operation(),operation()]);assert.equal(max,1);assert.ok(options.every(o=>o.mode==='exclusive'&&!('steal' in o)));
});
test('queued Auth timeout cancels only the waiter and reports the SDK timeout type',async()=>{
 let called=false;const locks={request:(_name,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('wait aborted','AbortError'))))};const lock=createNonStealingAuthLock(locks);
 await assert.rejects(lock('auth-test',10,async()=>{called=true;}),e=>e.isAcquireTimeout===true);assert.equal(called,false);
 const unavailable=createNonStealingAuthLock({request:(_name,options,fn)=>{assert.equal(options.ifAvailable,true);assert.equal(options.steal,undefined);return fn(null);}});await assert.rejects(unavailable('auth-test',0,async()=>{}),e=>e.isAcquireTimeout===true);
});
test('network aborts after acquisition keep their actual error rather than becoming Auth lock errors',async()=>{const lock=createNonStealingAuthLock({request:(_n,_o,fn)=>fn({name:'auth-test'})});const error=new DOMException('Network aborted','AbortError');await assert.rejects(lock('auth-test',100,async()=>{throw error;}),e=>e===error&&!e.isAcquireTimeout);});
