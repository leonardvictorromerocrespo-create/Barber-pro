import {test} from 'node:test';import assert from 'node:assert/strict';import {savePickupCart,readPickupCart,clearPickupCart} from '../src/lib/pickup-cart.js';
function storage(){const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};}
test('pickup selection survives login without caching account credentials',()=>{
 const s=storage(),saved=savePickupCart(s,{shop:42,items:[{productId:7,quantity:2}]},1000);assert.deepEqual(saved,{shop:'42',items:[{productId:'7',quantity:2}],savedAt:1000});assert.deepEqual(readPickupCart(s,1500),saved);assert.doesNotMatch(s.getItem('meryo-pickup-cart-v1'),/password|token|authorization/i);assert.equal(clearPickupCart(s),null);assert.equal(readPickupCart(s,1500),null);
});
test('invalid, duplicate, and expired cart rows are cleared instead of silently changed',()=>{
 const s=storage();assert.throws(()=>savePickupCart(s,{shop:'x',items:[{productId:7,quantity:1}]},1000));assert.throws(()=>savePickupCart(s,{shop:42,items:[{productId:7,quantity:1},{productId:7,quantity:2}]},1000));
 s.setItem('meryo-pickup-cart-v1',JSON.stringify({shop:'42',items:[{productId:'7',quantity:1}],savedAt:1000}));assert.equal(readPickupCart(s,3601001),null);
});
