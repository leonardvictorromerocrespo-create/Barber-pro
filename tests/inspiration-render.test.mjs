import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

test('inspiration detail respects its category and only offers booking for a validated service',async()=>{
 const styles=await fs.readFile(new URL('../src/components/InspirationGallery.css',import.meta.url),'utf8');
 assert.match(styles,/data-meryo-theme="barberia"\]\[data-meryo-mode="light"[\s\S]*?--inspiration-bg: #f4efe6/);
 assert.match(styles,/data-meryo-theme="beauty"\]\[data-meryo-mode="light"[\s\S]*?--inspiration-bg: #faf7f4/);
 assert.match(styles,/data-meryo-theme="beauty"\]\[data-meryo-mode="dark"[\s\S]*?--inspiration-bg: #392f38/);
 const output=path.resolve('dist/screen-render/inspiration.mjs');
 await fs.mkdir(path.dirname(output),{recursive:true});
 await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import InspirationGallery from './src/components/InspirationGallery.jsx';import {BookingModal} from './src/App.jsx';
 export function gallery(item,category='barberia'){return renderToStaticMarkup(React.createElement(InspirationGallery,{api:{},category,themeMode:category==='belleza'?'light':'dark',onBack(){},onViewProfile(){},onBook(){},onNavigate(){},initialPublication:item}));}
 export function booking(item,issue=''){const shop={id:item.barberia_id,name:item.shop_name,equipo:[{id:item.member_id,nombre:item.professional_name,servicios:[item.service_id]}],services:[{id:item.service_id,name:item.service_name,price:85,duration:'45 min',bookable:true}]};return renderToStaticMarkup(React.createElement(BookingModal,{catalogCategory:item.catalog_category,themeMode:item.catalog_category==='belleza'?'light':'dark',selectedShop:shop,selectedService:shop.services[0],selectedBarber:item.member_id,selectedDate:'2026-11-12',selectedTime:'',customerInfo:{name:'',phone:''},customRequest:'',activeSlots:[],finalPrice:85,requestSaved:false,savingReservation:false,reservationsEnabled:false,agendaLoading:false,agendaError:'',inspiration:item,inspirationIssue:issue,onClearInspiration(){}}));}`,
 resolveDir:process.cwd(),loader:'jsx'},outfile:output,bundle:true,platform:'node',format:'esm',jsx:'automatic',loader:{'.css':'empty','.png':'dataurl','.webp':'dataurl'},external:['react','react-dom/server'],plugins:[{name:'local-only',setup(b){b.onResolve({filter:/^(?:\.\.?\/)+lib\/supabase(?:\.js)?$/},()=>({path:path.resolve('src/lib/supabase.local.js')}));}}]});
 const {gallery,booking}=await import(pathToFileURL(output).href),item={id:'7b83d420-1144-48be-9c1d-5cf81e547311',url:'https://example.invalid/signed.jpg',title:'Corte en capas',description:'Capas suaves',catalog_category:'belleza',barberia_id:15,shop_name:'Salón de prueba',member_id:'6e648bbb-b222-4ee0-a18d-3db1cb7e9da1',professional_name:'Profesional de prueba',service_id:7,service_name:'Corte',can_request:true};
 const beauty=gallery(item,'belleza');assert.match(beauty,/data-meryo-theme="beauty"/);assert.match(beauty,/PELUQUERÍAS Y BELLEZA/);assert.match(beauty,/Quiero este estilo/);assert.match(beauty,/Corte en capas/);
 const barber=gallery({...item,catalog_category:'barberia'},'barberia');assert.match(barber,/data-meryo-theme="barberia"/);assert.match(barber,/BARBERÍAS/);assert.doesNotMatch(barber,/PELUQUERÍAS Y BELLEZA/);
 const noBooking=gallery({...item,can_request:false},'belleza');assert.doesNotMatch(noBooking,/Quiero este estilo/);
 const modal=booking(item,'El precio del servicio cambió.');assert.match(modal,/Referencia de estilo: Corte en capas/);assert.match(modal,/El precio del servicio cambió/);assert.match(modal,/Continuar sin esta referencia/);assert.match(modal,/disabled/);
});
