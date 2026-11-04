import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMeryoApi} from '../src/lib/meryo-api.js';

function clientFor(catalogue){
 const calls=[];
 return {
  calls,
  auth:{getSession(){throw new Error('Public catalogue must not wait for session restoration');}},
  rpc(name,args){
   calls.push({name,args});
   return {abortSignal(signal){this.signal=signal;return this;},then(resolve,reject){return Promise.resolve({data:[catalogue],error:null}).then(resolve,reject);}};
  },
  storage:{from(){throw new Error('The fixture has no media assets');}},
 };
}

test('direct public catalog entry loads its requested category with and without a restored session',async()=>{
 for(const hasSession of [false,true])for(const category of ['barberia','belleza']){
  const fixture={id:hasSession?2:1,nombre:category==='barberia'?'Barbería de prueba':'Salón de prueba',distrito:'Ate Vitarte',servicios:[],assets:[],tipos_negocio:[category]};
  const client=clientFor(fixture),api=createMeryoApi(client);
  const controller=new AbortController();
  const rows=await api.catalog(category,{signal:controller.signal});
  assert.equal(client.calls.length,1);
  assert.equal(client.calls[0].name,'meryo_catalogo_categoria');
  assert.equal(client.calls[0].args.p_categoria,category);
  assert.equal(rows.length,1);
  assert.equal(rows[0].businessTypes[0],category);
 }
});
