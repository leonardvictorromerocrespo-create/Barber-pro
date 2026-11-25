import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import {mergeFreshProfile} from '../src/lib/profile-refresh.js';
import {createMeryoApi} from '../src/lib/meryo-api.js';
const source=await fs.readFile('src/App.jsx','utf8');
const route=source.slice(source.indexOf('    if(shop){setSelectedShop'),source.indexOf('    else{setSelectedShop(null)',source.indexOf('    if(shop){setSelectedShop')));
const routeUpdate=new Function('shop','setSelectedShop','setShowProfileModal','setProfileUnavailable','mergeFreshProfile',route);
const start=source.indexOf('    if(!profileMediaOpen||!selectedShop){setProfileAssetsLoading');
const body=source.slice(start,source.indexOf('  },[api,profileMediaOpen,selectedShop?.id',start));
const load=new Function('api','showProfileModal','selectedShop','setProfileAssetsLoading','setProfileAssetsError','setSelectedShop','PROFILE_PHOTO_TITLE','profileMediaOpen=true',body);
const media=[{id:'work',kind:'foto',url:'/work.jpg'},{id:'video',kind:'video',url:'/video.mp4'}];
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){let shop={id:41,assets:[]},loading=false,error='',calls=0;const pending=[];return {
 get shop(){return shop},get loading(){return loading},get error(){return error},get calls(){return calls},
 setShop(value){shop=value},route(fresh){routeUpdate(fresh,update=>{shop=typeof update==='function'?update(shop):update},()=>{},()=>{},mergeFreshProfile)},
 open(){return load({shopAssets(id){calls++;return new Promise((resolve,reject)=>pending.push({id,resolve,reject}))}},true,shop,v=>{loading=v},v=>{error=v},update=>{shop=update(shop)},'[meryo-profile-photo]')},pending
};}
for(const mediaFirst of [true,false])test(`first opening keeps photos and video when ${mediaFirst?'media':'catalogue'} resolves first`,async()=>{
 const h=harness();h.route({id:41,assets:[{kind:'portada',url:'/cover.jpg'}]});h.open();assert.equal(h.loading,true);
 if(mediaFirst){h.pending[0].resolve(media);await flush()}
 h.route({id:41,assets:[{kind:'portada',url:'/new-cover.jpg'}],services:[]});
 if(!mediaFirst){h.pending[0].resolve(media);await flush()}
 assert.deepEqual(h.shop.assets,media);assert.equal(h.calls,1);assert.equal(h.loading,false);assert.equal(h.error,'');
});
test('late response of closed profile cannot mix with the next profile',async()=>{
 const h=harness(),close=h.open();close();h.setShop({id:52,assets:[]});h.open();h.pending[0].resolve(media);await flush();assert.deepEqual(h.shop.assets,[]);
 h.pending[1].resolve([{id:'other',kind:'video',url:'/other.mp4'}]);await flush();assert.equal(h.shop.id,52);assert.equal(h.shop.assets[0].id,'other');assert.equal(h.calls,2);
});
test('network failure stops loading without retrying; empty response is a successful empty result',async()=>{
 const h=harness();h.open();h.pending[0].reject(Error('red de prueba'));await flush();assert.equal(h.loading,false);assert.match(h.error,/red de prueba/);assert.equal(h.calls,1);
 const empty=harness();empty.open();empty.pending[0].resolve([]);await flush();assert.deepEqual(empty.shop.assets,[]);assert.equal(empty.loading,false);assert.equal(empty.error,'');
});
test('partial signing failure is reported instead of silently hiding published media',async()=>{
 const rows=[{id:'work',kind:'foto',object_path:'41/work.jpg'}];
 const request={select(){return this},eq(){return this},order:async()=>({data:rows,error:null})};
 const api=createMeryoApi({from:()=>request,storage:{from:()=>({createSignedUrls:async()=>({data:[{error:'Object unavailable'}],error:null})})}});
 await assert.rejects(api.shopAssets(41),/algunos archivos del perfil/);
});
test('profile tabs distinguish loading, empty and errors; (+) retains its callback',async()=>{
 const out=path.resolve('dist/profile-media-test/view.mjs');await fs.mkdir(path.dirname(out),{recursive:true});
 await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import Profile from './src/components/ProfileModal.jsx';export const html=props=>renderToStaticMarkup(React.createElement(Profile,props));export {default as Profile} from './src/components/ProfileModal.jsx';`,resolveDir:process.cwd(),loader:'jsx'},outfile:out,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react-dom/server'],loader:{'.css':'empty'},plugins:[{name:'hooks',setup(b){b.onResolve({filter:/^react$/},args=>args.importer.endsWith('ProfileModal.jsx')?{path:'hooks',namespace:'test'}:undefined);b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const useState=x=>[x,value=>globalThis.__profileTransitions?.push(value)];export const useRef=x=>({current:x});export const useEffect=()=>{};'}));}}]});
 const {html,Profile}=await import(pathToFileURL(out));const service={id:1,name:'Corte largo',price:30,bookable:true};
 const base={selectedShop:{id:41,name:'Negocio',services:[service],assets:media},onClose(){},onReserve(){}};
 for(const category of ['barberia','belleza'])for(const themeMode of ['light','dark'])for(const tab of ['trabajos','informacion']){
 const props={...base,catalogCategory:category,themeMode,initialTab:tab};const loaded=html(props);assert.ok(loaded.includes(tab==='trabajos'?'/work.jpg':'/video.mp4'));
 assert.match(html({...props,contentLoading:true}),/role="status"/);assert.match(html({...props,contentError:'Fallo de red',onRetryContent(){}}),/Reintentar contenido/);
 const empty=html({...props,selectedShop:{...props.selectedShop,assets:[]}});assert.match(empty,tab==='trabajos'?/aún no publicó trabajos/:/aún no publicó un video/);
 }
 function walk(node){if(!node||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(walk);return [node,...walk(node.props?.children)]}
 let chosen;const nodes=walk(Profile({...base,onReserve:s=>{chosen=s}}));const action=nodes.find(n=>n.type==='button'&&n.props.className?.includes('meryo-profile-row-action'));action.props.onClick();assert.equal(chosen,service);assert.equal(action.props.disabled,false);
 globalThis.__profileTransitions=[];globalThis.window={location:{origin:'http://127.0.0.1'},requestAnimationFrame:fn=>fn()};
 try {for(const name of ['servicios','equipo','trabajos','informacion']){nodes.find(n=>n.type==='button'&&n.props.id===`meryo-profile-tab-${name}`).props.onClick();}assert.deepEqual(globalThis.__profileTransitions,['servicios','equipo','trabajos','informacion']);}
 finally {delete globalThis.window;delete globalThis.__profileTransitions;}
});
