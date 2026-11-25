import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const member={id:'10000000-0000-4000-8000-000000000001',nombre:'Profesional de nombre largo',servicios:[1],propietario:true};
const service={id:1,name:'Servicio',price:30,duration:'30 min',bookable:true};
const asset={kind:'foto',title:`[meryo-team-photo:${member.id}]`,object_path:`41/team/${member.id}/20000000-0000-4000-8000-000000000002.jpg`,url:'https://media.test/individual.jpg'};
const shop={id:41,name:'Negocio',assets:[asset],services:[service],equipo:[member]};

test('both catalogues use the same photo in Equipo and booking; foreign assets are ignored',async()=>{
 const out=path.resolve('dist/professional-tests/render.mjs');await fs.mkdir(path.dirname(out),{recursive:true});
 await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import Profile from './src/components/ProfileModal.jsx';import {BookingModal} from './src/components/BookingModal.jsx';export {professionalPhoto} from './src/components/ProfessionalAvatar.jsx';export const profile=p=>renderToStaticMarkup(React.createElement(Profile,p));export const booking=p=>renderToStaticMarkup(React.createElement(BookingModal,p));`,resolveDir:process.cwd(),loader:'jsx'},outfile:out,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react-dom/server'],loader:{'.css':'empty'}});
 const {profile,booking,professionalPhoto}=await import(pathToFileURL(out));
 assert.equal(professionalPhoto(shop,member),asset.url);
 assert.equal(professionalPhoto({...shop,id:42},member),'');
 assert.equal(professionalPhoto(shop,{...member,id:'30000000-0000-4000-8000-000000000003'}),'');
 for(const category of ['barberia','belleza'])for(const themeMode of ['light','dark']){
  const props={selectedShop:shop,catalogCategory:category,themeMode,onClose(){},onReserve(){},initialTab:'equipo'};
  const team=profile(props);const reserve=booking({...props,selectedService:service,selectedBarber:member.id,customerInfo:{},selectedDate:'2026-11-25',setSelectedTime(){}});
  for(const html of [team,reserve])assert.ok(html.includes(`src="${asset.url}"`));
  assert.match(reserve,/aria-pressed="true"/);assert.match(reserve,/Disponible para este servicio/);
  if(themeMode==='light')assert.match(team,/>Propietario<\/p>/);
 }
});

test('invalid image falls back to initials and professional selection keeps the existing callbacks',async()=>{
 const out=path.resolve('dist/professional-tests/actions.mjs');
 await build({stdin:{contents:`export {default as Avatar} from './src/components/ProfessionalAvatar.jsx';export {BookingModal} from './src/components/BookingModal.jsx';`,resolveDir:process.cwd(),loader:'jsx'},outfile:out,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime'],plugins:[{name:'hooks',setup(b){b.onResolve({filter:/^react$/},args=>/ProfessionalAvatar|BookingModal/.test(args.importer)?{path:args.importer.endsWith('ProfessionalAvatar.jsx')?'avatar':'booking',namespace:'hooks'}:undefined);b.onLoad({filter:/.*/,namespace:'hooks'},args=>({contents:`export const useState=x=>[${args.path==='avatar'?'globalThis.__professionalFailed??':''}(typeof x==='function'?x():x),value=>{${args.path==='avatar'?'globalThis.__professionalFailed=value;':''}}];export const useEffect=()=>{};export const useRef=x=>({current:x});export const useMemo=f=>f();`}));}}]});
 const {Avatar,BookingModal}=await import(pathToFileURL(out));
 try{let image=Avatar({shop,member,className:'avatar'}).props.children;assert.equal(image.type,'img');image.props.onError();assert.equal(Avatar({shop,member,className:'avatar'}).props.children,'PD');}finally{delete globalThis.__professionalFailed;}
 function walk(n){return !n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(walk):[n,...walk(n.props?.children)];}
 for(const category of ['barberia','belleza']){
  let chosen,time='previous';const tree=walk(BookingModal({selectedShop:shop,selectedService:service,catalogCategory:category,themeMode:'light',selectedBarber:'',customerInfo:{},onBarberSelect:id=>{chosen=id;},setSelectedTime:value=>{time=value;}}));
  tree.find(n=>n.type==='button'&&n.props.className?.includes('meryo-booking-member-option')).props.onClick();assert.equal(chosen,member.id);assert.equal(time,'');
 }
});
