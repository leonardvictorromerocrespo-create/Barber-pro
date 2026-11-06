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
 assert.deepEqual(readDraft(session,2000),{shop:'15',service:'7',barber:'6e648bbb-b222-4ee0-a18d-3db1cb7e9da1',category:'belleza',date:'2026-11-08',time:'2026-11-08T15:00:00Z',name:'',phone:'',note:'',campaignId:null,regularPrice:null,salonPromotionId:'e3987269-8777-4b66-8b65-d9e3a2c9ef01',salonRegularPrice:80,salonPromoPrice:50,savedAt:1000});
});

test('malformed salon campaign identifiers are not restored as offer selections',()=>{
 const session=storage();
 saveDraft(session,{shop:15,service:7,category:'belleza',date:'2026-11-08',salonPromotionId:'not-a-uuid',salonRegularPrice:80,salonPromoPrice:50},1000);
 const restored=readDraft(session,2000);assert.equal(restored.salonPromotionId,null);assert.equal(restored.salonPromoPrice,null);assert.equal(restored.salonRegularPrice,80);
 clearDraft(session);assert.equal(readDraft(session,2000),null);
});
