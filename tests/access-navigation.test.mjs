import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rememberAccess,consumeAccess,accessView} from '../src/lib/access-navigation.js';
const store=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
test('OAuth returns to the requested existing screen once; arbitrary URLs are discarded',()=>{
 for(const target of ['admin','barber','client']){const storage=store();rememberAccess(storage,target);assert.equal(consumeAccess(storage),target);assert.equal(consumeAccess(storage),'client');}
 const storage=store();rememberAccess(storage,'https://example.org');assert.equal(consumeAccess(storage),'client');
});
test('admin navigation keeps the existing admin gate; barber link routes real admins correctly',()=>{
 assert.equal(accessView('barber','admin'),'admin');
 assert.equal(accessView('barber','barbero'),'shop-manage');
 assert.equal(accessView('admin','cliente'),'admin'); // App still denies permission; no role assignment.
 assert.equal(accessView('client','admin'),'client');
});
