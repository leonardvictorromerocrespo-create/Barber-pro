import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

test('public business profile keeps its two-column order and separates cover, avatar and portfolio',async()=>{
 const output=path.resolve('dist/profile-modal-render/view.mjs');
 await fs.mkdir(path.dirname(output),{recursive:true});
 await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {ProfileModal} from './src/App.jsx';export const render=(shop)=>renderToStaticMarkup(React.createElement(ProfileModal,{selectedShop:shop,onClose(){},onReserve(){},onStore(){}}));`,resolveDir:process.cwd(),loader:'jsx'},outfile:output,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react-dom/server'],loader:{'.css':'empty','.png':'dataurl','.webp':'file'},plugins:[{name:'local-only',setup(context){context.onResolve({filter:/^(?:\.\.?\/)+lib\/supabase(?:\.js)?$/},()=>({path:path.resolve('src/lib/supabase.local.js')}));}}]});
 const {render}=await import(pathToFileURL(output).href);
 const markup=render({id:7,name:'Barbería local',district:'Ate Vitarte',direccion:'Dirección publicada',about:'Descripción real del negocio.',image:'/presentation.webp',coverImage:'/cover.webp',profileImage:'/profile.webp',businessTypes:['barberia'],equipo:[{nombre:'Profesional'}],services:[{id:1,name:'Corte clásico',duration:'30 min',price:30,bookable:true}],assets:[{id:'avatar',kind:'foto',title:'[meryo-profile-photo]',url:'/profile.webp'},{id:'work',kind:'foto',title:'Trabajo',url:'/work.webp'},{id:'video',kind:'video',url:'/video.mp4'}]});
 assert.match(markup,/src="\/cover\.webp" alt="Portada de Barbería local"/);
 assert.match(markup,/src="\/profile\.webp" alt="Foto de Barbería local"/);
 assert.match(markup,/Descripción real del negocio/);
 assert.match(markup,/grid-cols-2/);
 assert.ok(markup.indexOf('Reservar cita')<markup.indexOf('Tienda'));
 assert.ok(markup.indexOf('Tienda')<markup.indexOf('Compartir perfil'));
 assert.ok(markup.indexOf('Compartir perfil')<markup.indexOf('Equipo'));
 assert.ok(markup.indexOf('Equipo')<markup.indexOf('Servicios'));
 assert.ok(markup.indexOf('Ubicación')<markup.indexOf('Video'));
 assert.ok(markup.indexOf('Video')<markup.indexOf('Portafolio'));
 assert.doesNotMatch(markup,/Presentación<\/h4>|meryo-profile-photo/);
});

test('public profile falls back to a business initial when no profile photo exists',async()=>{
 const output=path.resolve('dist/profile-modal-render/view.mjs');
 const {render}=await import(pathToFileURL(output).href);
 const markup=render({id:8,name:'Norte Studio',about:'Texto',assets:[],services:[],equipo:[]});
 assert.match(markup,/>NS<\/div>/);
 assert.doesNotMatch(markup,/alt="Foto de Norte Studio"/);
});
