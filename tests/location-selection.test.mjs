import {test} from 'node:test';import assert from 'node:assert/strict';import {initialLocation,locationReady,selectLocation} from '../src/lib/location-selection.js';
const lima={lat:-12.0464,lng:-77.0428};
test('Lima viewport and incoming unsaved coordinates never confirm a location',()=>{
 assert.equal(locationReady(initialLocation(lima)),false);assert.equal(initialLocation(lima).point,null);assert.equal(locationReady(initialLocation({lat:'',lng:''})),false);
 const saved=initialLocation(lima,true);assert.equal(saved.status,'saved');assert.equal(locationReady(saved),true);assert.deepEqual(saved.point,lima);
});
test('failed geolocation invalidates confirmation, including a previous selected point',()=>{
 let s=selectLocation(initialLocation(lima),{type:'manual',point:lima});assert.equal(locationReady(s),true);s=selectLocation(s,{type:'start'});assert.equal(locationReady(s),false);s=selectLocation(s,{type:'failed',message:'No autorizaste la ubicación'});assert.equal(locationReady(s),false);assert.equal(s.point,null);assert.equal(s.candidate,null);assert.equal(s.status,'empty');
});
test('successful geolocation remains a candidate until explicit confirmation; invalid results cannot be confirmed',()=>{
 const candidate=selectLocation(initialLocation(),{type:'found',point:lima});assert.equal(locationReady(candidate),false);assert.equal(candidate.point,null);assert.deepEqual(candidate.candidate,lima);const confirmed=selectLocation(candidate,{type:'confirm'});assert.equal(locationReady(confirmed),true);assert.deepEqual(confirmed.point,lima);
 const invalid=selectLocation(initialLocation(),{type:'found',point:{lat:91,lng:0}});assert.equal(locationReady(selectLocation(invalid,{type:'confirm'})),false);
});
test('an explicit map choice or drag clears errors and confirms only the chosen coordinates',()=>{
 let s=selectLocation(initialLocation(),{type:'failed',message:'Error'});s=selectLocation(s,{type:'manual',point:lima});assert.equal(s.error,'');assert.equal(locationReady(s),true);const moved={lat:-12.047,lng:-77.043};s=selectLocation(s,{type:'manual',point:moved});assert.deepEqual(s.point,moved);
});
