import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saveDraft,readDraft,clearDraft} from '../src/lib/booking-draft.js';

function storage(){
 const values=new Map();
 return {setItem:(key,value)=>values.set(key,String(value)),getItem:key=>values.get(key)??null,removeItem:key=>values.delete(key)};
}

test('salon promotion selection survives Google/email login return without changing its expected prices',()=>{
 const session=storage();
 const saved=saveDraft(session,{shop:15,service:7,barber:'6e648bbb-b222-4ee0-a18d-3db1cb7e9da1',category:'belleza',date:'2026-11-08',time:'2026-11-08T15:00:00Z',salonPromotionId:'e3987269-8777-4b66-8b65-d9e3a2c9ef01',salonRegularPrice:80,salonPromoPrice:50},1000);
 assert.equal(saved.salonRegularPrice,80);assert.equal(saved.salonPromoPrice,50);
 assert.deepEqual(readDraft(session,2000),{shop:'15',service:'7',barber:'6e648bbb-b222-4ee0-a18d-3db1cb7e9da1',category:'belleza',date:'2026-11-08',time:'2026-11-08T15:00:00Z',name:'',phone:'',note:'',turnFinder:false,finderExpectedPrice:null,campaignId:null,regularPrice:null,salonPromotionId:'e3987269-8777-4b66-8b65-d9e3a2c9ef01',salonRegularPrice:80,salonPromoPrice:50,inspirationPublicationId:null,inspirationExpectedPrice:null,inspirationTitle:'',savedAt:1000});
});

test('malformed salon campaign identifiers are not restored as offer selections',()=>{
 const session=storage();
 saveDraft(session,{shop:15,service:7,category:'belleza',date:'2026-11-08',salonPromotionId:'not-a-uuid',salonRegularPrice:80,salonPromoPrice:50},1000);
 const restored=readDraft(session,2000);assert.equal(restored.salonPromotionId,null);assert.equal(restored.salonPromoPrice,null);assert.equal(restored.salonRegularPrice,80);
 clearDraft(session);assert.equal(readDraft(session,2000),null);
});

test('finder selection returns after Google/email sign-in with its exact service, professional, slot and price snapshot',()=>{
 const session=storage();
 saveDraft(session,{shop:22,service:9,barber:'6e648bbb-b222-4ee0-a18d-3db1cb7e9da1',category:'barberia',date:'2026-11-10',time:'2026-11-10T22:30:00.000Z',turnFinder:true,finderExpectedPrice:35},1000);
 const restored=readDraft(session,2000);
 assert.equal(restored.turnFinder,true);assert.equal(restored.finderExpectedPrice,35);
 assert.equal(restored.shop,'22');assert.equal(restored.service,'9');assert.equal(restored.barber,'6e648bbb-b222-4ee0-a18d-3db1cb7e9da1');
 assert.equal(restored.date,'2026-11-10');assert.equal(restored.time,'2026-11-10T22:30:00.000Z');
});

test('beauty finder selection preserves the price snapshot across login for the server check',()=>{
 const session=storage();
 saveDraft(session,{shop:22,service:9,category:'belleza',date:'2026-11-10',turnFinder:true,finderExpectedPrice:35},1000);
 const restored=readDraft(session,2000);
 assert.equal(restored.category,'belleza');assert.equal(restored.turnFinder,true);assert.equal(restored.finderExpectedPrice,35);
});

test('inspiration publication reference and reviewed price survive login without changing the booking selection',()=>{
 const session=storage(),publication='7b83d420-1144-48be-9c1d-5cf81e547311',member='6e648bbb-b222-4ee0-a18d-3db1cb7e9da1';
 saveDraft(session,{shop:15,service:7,barber:member,category:'belleza',date:'2026-11-12',time:'2026-11-12T20:00:00Z',name:'Ana',phone:'999999999',note:'capas',inspirationPublicationId:publication,inspirationExpectedPrice:85,inspirationTitle:'Corte en capas'},3000);
 const restored=readDraft(session,4000);
 assert.equal(restored.inspirationPublicationId,publication);assert.equal(restored.inspirationExpectedPrice,85);assert.equal(restored.inspirationTitle,'Corte en capas');
 assert.equal(restored.shop,'15');assert.equal(restored.service,'7');assert.equal(restored.barber,member);assert.equal(restored.category,'belleza');assert.equal(restored.date,'2026-11-12');assert.equal(restored.time,'2026-11-12T20:00:00Z');
 assert.equal(restored.finderExpectedPrice,null);assert.equal(restored.turnFinder,false);
});

test('a tagged Google booking keeps its origin after the login draft is reloaded',()=>{
 const data=new Map();
 const session={setItem:(key,value)=>data.set(key,value),getItem:key=>data.get(key),removeItem:key=>data.delete(key)};
 const draft={shop:22,service:9,date:'2026-11-10',origin:'ficha_google'};
 saveDraft(session,draft,1000);
 assert.equal(readDraft(session,2000).origin,'ficha_google');
 saveDraft(session,{...draft,origin:'fake_campaign'},1000);
 assert.equal(readDraft(session,2000).origin,undefined);
});
