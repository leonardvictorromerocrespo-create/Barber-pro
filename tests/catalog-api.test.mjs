import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMeryoApi} from '../src/lib/meryo-api.js';
import {contentKindForForm,PROFILE_PHOTO_TITLE,validateContent} from '../src/lib/shop-content.js';

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

test('public profile media separates cover, profile photo and portfolio without exposing its internal marker',async()=>{
 const row={id:9,nombre:'Barbería',distrito:'Ate Vitarte',imagen_url:'/legacy-cover.webp',servicios:[],tipos_negocio:['barberia'],assets:[
  {id:'cover',kind:'portada',object_path:'9/cover.webp',title:'Portada'},
  {id:'avatar',kind:'foto',object_path:'9/avatar.webp',title:'[meryo-profile-photo]'},
  {id:'work',kind:'foto',object_path:'9/work.webp',title:'Fade'},
 ]};
 const client=clientFor(row);
 client.storage={from(){return {createSignedUrls:async paths=>({data:paths.map(path=>({signedUrl:`https://media.test/${path}`})),error:null})};}};
 const [shop]=await createMeryoApi(client).catalog('barberia');
 assert.equal(shop.image,'https://media.test/9/cover.webp');
 assert.equal(shop.coverImage,'https://media.test/9/cover.webp');
 assert.equal(shop.profileImage,'https://media.test/9/avatar.webp');
 assert.deepEqual(shop.assets.map(asset=>asset.id),['cover','work']);
 assert.equal(shop.assets.some(asset=>asset.title==='[meryo-profile-photo]'),false);
});

test('owner media upload rejects a different business ID before touching Storage',async()=>{
 let storageTouched=false;
 const client={
  auth:{getUser:async()=>({data:{user:{id:'owner-1'}},error:null})},
  from(){const query={select(){return query;},eq(){return query;},single:async()=>({data:{id:'owner-1',rol:'barbero',activo:true,barberia_id:7},error:null})};return query;},
  storage:{from(){storageTouched=true;throw Error('Storage should not be reached');}},
 };
 const api=createMeryoApi(client);
 await assert.rejects(api.uploadAsset(8,{},'portada',''),/Solo puedes subir contenido para tu propio negocio/);
 assert.equal(storageTouched,false);
});

test('profile photo uses the existing image upload contract and a private display marker',()=>{
 assert.equal(contentKindForForm('perfil'),'foto');
 assert.equal(contentKindForForm('portada'),'portada');
 assert.equal(contentKindForForm('video'),'video');
 assert.equal(validateContent(new File(['image'],'profile.jpg',{type:'image/jpeg'}),contentKindForForm('perfil')),'jpg');
 assert.equal(PROFILE_PHOTO_TITLE,'[meryo-profile-photo]');
});
