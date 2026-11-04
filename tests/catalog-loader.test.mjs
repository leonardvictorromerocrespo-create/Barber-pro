import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogLoader} from '../src/lib/catalog-loader.js';

function deferred(){
 let resolve,reject;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
 return {promise,resolve,reject};
}

test('direct beauty load starts empty and never paints the previous barber catalog',async()=>{
 const pending=deferred();let state={category:'barberia',rows:[{name:'Barbershoppi'}],loading:false,error:''};
 const loader=createCatalogLoader(()=>pending.promise,next=>{state=next;});
 const loading=loader.load('belleza');
 assert.deepEqual(state,{category:'belleza',rows:[],loading:true,error:''});
 pending.resolve([{name:'Salón de prueba'}]);
 assert.equal(await loading,true);
 assert.equal(state.category,'belleza');
 assert.deepEqual(state.rows,[{name:'Salón de prueba'}]);
});

test('late responses from the old category cannot replace current results or errors',async()=>{
 const barber=deferred(),beauty=deferred();let state;
 const loader=createCatalogLoader(category=>category==='barberia'?barber.promise:beauty.promise,next=>{state=next;});
 const old=loader.load('barberia');
 const current=loader.load('belleza');
 beauty.resolve([{name:'Salón de prueba'}]);
 assert.equal(await current,true);
 barber.reject(new Error('Error tardío del catálogo anterior'));
 assert.equal(await old,false);
 assert.equal(state.category,'belleza');
 assert.deepEqual(state.rows,[{name:'Salón de prueba'}]);
 assert.equal(state.error,'');
});

test('an explicit navigation reset invalidates pending work before the next effect runs',async()=>{
 const pending=deferred();let state;
 const loader=createCatalogLoader(()=>pending.promise,next=>{state=next;});
 const old=loader.load('barberia');
 loader.reset('belleza');
 assert.deepEqual(state,{category:'belleza',rows:[],loading:true,error:''});
 assert.equal(await old,false);
  pending.resolve([{name:'Barbershoppi'}]);
  await Promise.resolve();
 assert.deepEqual(state,{category:'belleza',rows:[],loading:true,error:''});
});

test('a stalled catalog request times out with an error and can recover through retry',async()=>{
 const slow=deferred();let state,firstSignal,calls=0;
 const loader=createCatalogLoader((category,{signal})=>{
  calls++;
  if(calls===1){firstSignal=signal;return slow.promise;}
  return Promise.resolve([{name:category==='barberia'?'Barbería vigente':'Salón vigente'}]);
 },next=>{state=next;},{timeoutMs:15});
 const first=loader.load('barberia');
 assert.deepEqual(state,{category:'barberia',rows:[],loading:true,error:''});
 assert.equal(await first,false);
 assert.equal(firstSignal.aborted,true);
 assert.equal(state.loading,false);
 assert.match(state.error,/tardó demasiado/i);
 assert.deepEqual(state.rows,[]);
 assert.equal(await loader.load('barberia'),true);
 assert.equal(state.error,'');
 assert.deepEqual(state.rows,[{name:'Barbería vigente'}]);
 slow.resolve([{name:'respuesta tardía'}]);
 await Promise.resolve();
 assert.deepEqual(state.rows,[{name:'Barbería vigente'}]);
});

test('a rejected catalog request is an error, not an empty catalog, and retry succeeds',async()=>{
 let state,calls=0;
 const loader=createCatalogLoader(()=>{
  calls++;
  return calls===1?Promise.reject(new Error('Sin conexión')):Promise.resolve([{name:'Barbería'}]);
 },next=>{state=next;},{timeoutMs:100});
 assert.equal(await loader.load('barberia'),false);
 assert.equal(state.loading,false);
 assert.equal(state.error,'Sin conexión');
 assert.deepEqual(state.rows,[]);
 assert.equal(await loader.load('barberia'),true);
 assert.deepEqual(state.rows,[{name:'Barbería'}]);
});
