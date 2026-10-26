import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saveDraft,readDraft,beginGoogle,clearDraft} from '../src/lib/booking-draft.js';
test('only reservation fields survive authentication; TTL and logout clear PII',()=>{
 const map=new Map(),storage={setItem:(k,v)=>map.set(k,v),getItem:k=>map.get(k),removeItem:k=>map.delete(k)};
 saveDraft(storage,{shop:1,service:2,date:'2026-10-28',time:'2026-10-28T10:00:00-05:00',name:'Cliente',phone:'999999999',note:'Pedido',password:'never',rol:'admin',access_token:'never'},1000);
 assert.equal(readDraft(storage,2000).service,'2');assert.ok(![...map.values()][0].includes('never'));assert.equal(readDraft(storage,1000+31*60000),null);
 saveDraft(storage,{shop:1,service:2,date:'2026-10-28'},1000);clearDraft(storage);assert.equal(map.size,0);
});
test('Google uses real Supabase OAuth with minimal scopes and a fixed callback, no roles',async()=>{
 let args;const client={auth:{signInWithOAuth:async a=>{args=a;return {error:null};}}};
 await assert.rejects(beginGoogle(client,{enabled:false,origin:'http://127.0.0.1:5178'}),/pendiente/);assert.equal(args,undefined);
 await beginGoogle(client,{enabled:true,origin:'http://127.0.0.1:5178'});assert.equal(args.provider,'google');assert.equal(args.options.scopes,'openid email profile');assert.equal(args.options.redirectTo,'http://127.0.0.1:5178/?auth_callback=1');assert.ok(!JSON.stringify(args).includes('admin'));
});
