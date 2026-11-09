import {test} from 'node:test';
import assert from 'node:assert/strict';
import {findTurns,turnKey} from '../src/lib/turn-finder.js';

const shop=(id=1,overrides={})=>({id,name:`Barbería ${id}`,district:'Ate Vitarte',businessTypes:['barberia'],services:[{id:10,name:'Corte degradado',price:35,durationMinutes:30,bookable:true}],equipo:[{id:`member-${id}`,nombre:'Profesional de prueba',servicios:['10']}],...overrides});
const filters={district:turnKey('Ate Vitarte'),service:turnKey('Corte degradado'),date:'2026-11-10',after:'16:00',max:40};
const openSlot={time:'2026-11-10T22:30:00.000Z',label:'17:30',occupied:false};

test('exact published service and assigned professional use only live Lima slots and habitual prices',async()=>{
  let calls=0;
  const result=await findTurns([
    shop(),shop(2,{district:'Lima'}),shop(3,{services:[{id:11,name:'Corte con tijera',price:35,bookable:true}]}),
    shop(4,{services:[{id:12,name:'Corte degradado',price:41,bookable:true}]}),
    shop(5,{services:[{id:13,name:'Corte degradado',price:30,bookable:false}]})
  ],filters,async (...args)=>{calls++;assert.deepEqual(args,[1,10,filters.date,'member-1']);return [{...openSlot},{time:'2026-11-10T20:00:00.000Z',label:'15:00',occupied:false}];});
  assert.equal(calls,1);assert.equal(result.matches.length,1);assert.equal(result.matches[0].slot.time,openSlot.time);
  assert.equal(result.matches[0].date,filters.date);assert.equal(result.matches[0].member.id,'member-1');assert.equal(result.matches[0].service.price,35);
});

test('no matching slots is a valid empty result, not a query failure',async()=>{
  const result=await findTurns([shop()],filters,async()=>[]);
  assert.deepEqual(result,{matches:[],checked:1,failed:0,limited:false,allFailed:false});
});

test('an agenda outage is distinct from no matches; one working response is marked partial',async()=>{
  const total=await findTurns([shop()],filters,async()=>{throw Error('network');});
  assert.equal(total.allFailed,true);assert.equal(total.failed,1);assert.equal(total.matches.length,0);
  const partial=await findTurns([shop(),shop(2)],filters,async(id)=>{if(id===1)throw Error('network');return [openSlot];});
  assert.equal(partial.allFailed,false);assert.equal(partial.failed,1);assert.equal(partial.matches.length,1);
});

test('catalog scale is capped at 24 candidates and four active agenda requests',async()=>{
  let calls=0,active=0,maxActive=0;
  const result=await findTurns(Array.from({length:30},(_,index)=>shop(index+1)),filters,async()=>{
    calls++;active++;maxActive=Math.max(maxActive,active);await new Promise(resolve=>setTimeout(resolve,2));active--;return [openSlot];
  });
  assert.equal(calls,24);assert.equal(maxActive,4);assert.equal(result.checked,24);assert.equal(result.limited,true);assert.equal(result.allFailed,false);
});

test('filter changes invalidate in-flight responses and do not start the remaining candidate queries',async()=>{
  let current=true,calls=0,release;
  const wait=new Promise(resolve=>{release=resolve;});
  const pending=findTurns(Array.from({length:8},(_,index)=>shop(index+1)),filters,async()=>{calls++;await wait;return [openSlot];},()=>current);
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(calls,4);
  current=false;release();
  const stale=await pending;
  assert.equal(stale.matches.length,0);assert.equal(calls,4);
});

test('an occupied slot returned by the server can never be a finder result',async()=>{
  const result=await findTurns([shop()],filters,async()=>[{...openSlot,occupied:true}]);
  assert.equal(result.matches.length,0);assert.equal(result.failed,0);
});

test('today without a budget returns the first three distinct future slots from the Lima date',async()=>{
  const time=(iso,occupied=false)=>({time:iso,occupied});
  const expected=[
    time('2026-11-10T21:00:00Z'), time('2026-11-10T23:00:00Z'), time('2026-11-11T00:00:00Z'),
  ];
  const result=await findTurns([shop()],{...filters,max:'',notBefore:Date.parse('2026-11-10T20:45:00Z')},async()=>[
    time('2026-11-11T05:00:00Z'), time('2026-11-10T20:30:00Z'), time('2026-11-10T20:50:00Z',true),
    time('2026-11-11T01:00:00Z'), expected[2], expected[0], expected[1], expected[0],
  ]);
  assert.deepEqual(result.matches[0].options,expected);
  assert.equal(result.matches[0].slot,expected[0]);
});

test('an explicit budget still excludes expensive services',async()=>{
  const result=await findTurns([shop()],{...filters,max:'34.99'},async()=>assert.fail('over-budget agenda queried'));
  assert.equal(result.checked,0);
  assert.equal(result.matches.length,0);
});

test('beauty finder excludes barberies and services needing evaluation or missing price/duration',async()=>{
  const beauty=shop(21,{name:'Salón sintético A',businessTypes:['belleza'],services:[
    {id:31,name:'Corte de cabello',price:120,durationMinutes:90,bookable:true},
    {id:32,name:'Corte de cabello',price:40,durationMinutes:30,requiresEvaluation:true,bookable:true},
    {id:33,name:'Corte de cabello',price:null,durationMinutes:45,bookable:true},
    {id:34,name:'Corte de cabello',price:65,durationMinutes:null,bookable:true},
  ],equipo:[{id:'beauty-member',nombre:'Profesional salón de prueba',servicios:['31','32','33','34']}]});
  const mixed=shop(22,{name:'Negocio mixto sintético',businessTypes:['barberia','belleza'],services:[{id:10,name:'Corte de cabello',price:35,durationMinutes:30,bookable:true}]});
  const barber=shop(23,{name:'Barbería sintética',businessTypes:['barberia'],services:[{id:10,name:'Corte de cabello',price:35,durationMinutes:30,bookable:true}]});
  const beautyFilters={...filters,category:'belleza',district:turnKey('Ate Vitarte'),service:turnKey('Corte de cabello'),max:140};
  const calls=[];
  const result=await findTurns([beauty,mixed,barber],beautyFilters,async(id,service,date,member)=>{calls.push([id,service,member]);return [openSlot];});
  assert.deepEqual(calls,[[21,31,'beauty-member'],[22,10,'member-22']]);
  assert.deepEqual(result.matches.map(row=>row.shop.id).sort((a,b)=>a-b),[21,22]);
});
