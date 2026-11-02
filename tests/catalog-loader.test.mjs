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
 pending.resolve([{name:'Barbershoppi'}]);
 assert.equal(await old,false);
 assert.deepEqual(state,{category:'belleza',rows:[],loading:true,error:''});
});
