import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

test('existing screens render without a fictitious identity or a payment confirmation',async()=>{
 const output=path.resolve('dist/screen-render/screen.mjs');
 await fs.mkdir(path.dirname(output),{recursive:true});
 await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import App,{BookingModal,ProfileModal} from './src/App.jsx';import LandingPage from './src/components/LandingPage.jsx';import {catalogCountLabel} from './src/lib/catalog-copy.js';
   export function screen(view,search=''){globalThis.window={location:{hash:'#'+view,search},history:{replaceState(){}}};try{return renderToStaticMarkup(React.createElement(App));}finally{delete globalThis.window;}}
   export function countLabel(category,count){return catalogCountLabel(category,count);}
   export function cover(profile=null){return renderToStaticMarkup(React.createElement(LandingPage,{setView(){},onExplore(){},profile,onSignIn(){},onAccount(){},onProfessionalAccess(){}}));}
   export function booking(shop,slots,category='barberia'){return renderToStaticMarkup(React.createElement(BookingModal,{catalogCategory:category,selectedShop:shop,selectedService:shop.services[0],selectedBarber:'member',selectedDate:'2026-10-27',selectedTime:'',customerInfo:{name:'',phone:''},customRequest:'',customExtra:0,paymentMethod:'Tarjeta',activeSlots:slots,finalPrice:30,requestSaved:false,savingReservation:false,reservationsEnabled:false,agendaLoading:false,agendaError:''}));}
   export function profile(shop,category){return renderToStaticMarkup(React.createElement(ProfileModal,{selectedShop:shop,catalogCategory:category,onClose(){},onReserve(){},onStore(){}}));}`,
   resolveDir:process.cwd(),loader:'jsx'},outfile:output,bundle:true,platform:'node',format:'esm',jsx:'automatic',loader:{'.css':'empty','.png':'dataurl','.webp':'file'},external:['react','react-dom/server'],plugins:[{name:'local-only',setup(b){b.onResolve({filter:/^(?:\.\.?\/)+lib\/supabase(?:\.js)?$/},()=>({path:path.resolve('src/lib/supabase.local.js')}));}}]});
 const {screen,booking,profile,cover,countLabel}=await import(pathToFileURL(output).href);
 assert.match(screen('client-register'),/Crear cuenta/);assert.match(screen('client-login'),/Iniciar sesión/);
 assert.match(screen('client-register'),/registro por correo está pendiente/);
 assert.match(screen('barber'),/Acceso profesional/);assert.doesNotMatch(screen('barber'),/Reservas reales/);
 assert.match(screen('barber-login'),/Continuar con Google/);
 assert.match(screen('admin'),/Comprobando sesión/);
 assert.doesNotMatch(screen('admin'),/Acceso barbero/);
 assert.match(screen('admin'),/Iniciar sesión como administrador/);assert.doesNotMatch(screen('admin'),/Barberías registradas/);
 assert.match(screen('shop-manage'),/cuenta de propietario real/);
 assert.match(screen('my-bookings'),/Comprobando sesión para abrir tu cita/);
 assert.match(screen('account-security'),/Iniciar sesión para proteger mi cuenta/);
 assert.doesNotMatch(screen('client'),/Este historial es una demostración local|Simular recibo|actor sintético/i);
 assert.doesNotMatch(screen('client'),/Barberos más reservados|en ranking/);
 assert.doesNotMatch(screen('landing'),/\+120/);
 const anonymousCover=cover();
 const coverHeader=anonymousCover.match(/<header class="meryo-site-header meryo-site-header--cover">([\s\S]*?)<\/header>/)?.[1]||'';
 assert.match(coverHeader,/>Ingresar<\/button>/);assert.match(coverHeader,/>Soy profesional<\/button>/);
 assert.doesNotMatch(coverHeader,/Explorar barberías|Explorar salones/);
 const clientCover=cover({rol:'cliente'});assert.match(clientCover,/<button[^>]*>Mi cuenta<\/button>/);assert.match(clientCover,/>Soy profesional<\/button>/);
 const barberCover=cover({rol:'barbero'});assert.match(barberCover,/>Soy profesional<\/button>/);
 const adminCover=cover({rol:'admin',activo:true});assert.match(adminCover,/>Soy profesional<\/button>/);
 const beautyCatalog=screen('client','?catalogo=belleza');
 assert.match(beautyCatalog,/data-meryo-theme="beauty"/);
 assert.match(beautyCatalog,/Peluquerías y salones cerca de ti/);
 assert.match(beautyCatalog,/TU BELLEZA, TU ESTILO/);
 assert.match(beautyCatalog,/Buscar salón/);
 assert.match(beautyCatalog,/Ordenar peluquerías y salones/);
 assert.match(beautyCatalog,/Cargando peluquerías y salones…/);
 assert.match(beautyCatalog,/Cargando…/);
 assert.doesNotMatch(beautyCatalog,/Próximamente encontrarás peluquerías y salones aquí/);
 assert.match(beautyCatalog,/el profesional del salón acepte/i);
 assert.doesNotMatch(beautyCatalog,/Barberías cerca de ti|Ordenar barberías|aria-label="Categoría de negocio"/);
 assert.equal(countLabel('belleza',1),'1 salón encontrado');assert.equal(countLabel('belleza',3),'3 salones encontrados');
 const barberCatalog=screen('client','?catalogo=barberia');
 assert.match(barberCatalog,/data-meryo-theme="barberia"/);
 assert.match(barberCatalog,/Barberías cerca de ti/);
 assert.match(barberCatalog,/Ordenar barberías/);
 assert.doesNotMatch(barberCatalog,/Peluquerías y salones cerca de ti|Ordenar peluquerías y salones/);
 const shop={id:1,name:'Barbería',equipo:[{id:'member',nombre:'Profesional',servicios:[1]}],services:[{id:1,name:'Corte local',duration:'30 min',price:30,bookable:true}]};
 const html=booking(shop,[]);assert.match(html,/Corte local/);assert.match(html,/30 min/);assert.match(html,/continúa con Google/);
 assert.match(html,/Solicitar cita/);assert.match(html,/hasta 15 minutos/);assert.match(html,/Barbero/);
 assert.match(booking(shop,[],'belleza'),/data-meryo-theme="beauty"/);
 assert.match(profile(shop,'belleza'),/data-meryo-theme="beauty"/);
 assert.doesNotMatch(html,/Reservas en preparación|Costo adicional|Sin extra|Tarjeta|Yape|Plin|Simular recibo/);

});

test('empty catalogue is distinct from loading and failure',async()=>{
 const output=path.resolve('dist/screen-render/catalog.mjs');
 await fs.mkdir(path.dirname(output),{recursive:true});
 await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import CatalogStatus from './src/components/CatalogStatus.jsx';export const render=(props)=>renderToStaticMarkup(React.createElement(CatalogStatus,props));`,resolveDir:process.cwd(),loader:'jsx'},outfile:output,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react-dom/server']});
 const {render}=await import(pathToFileURL(output).href);
 assert.match(render({empty:true,loading:false,error:''}),/Próximamente encontrarás barberías aquí/);
 assert.match(render({empty:true,loading:false,error:'',businessLabel:'peluquerías y salones'}),/Próximamente encontrarás peluquerías y salones aquí/);
 assert.doesNotMatch(render({empty:true,loading:true,error:''}),/Próximamente/);
 assert.equal(render({empty:true,loading:false,error:'Error'}),'');
 assert.equal(render({empty:false,loading:false,error:''}),'');
});

test('beauty palette is scoped and keeps accessible text contrast at responsive sizes',async()=>{
 const css=await fs.readFile(path.resolve('src/beauty-theme.css'),'utf8');
 assert.match(css,/^\[data-meryo-theme="beauty"\]/m);
 assert.match(css,/@media \(max-width: 640px\)/);
 assert.doesNotMatch(css,/:root\s*\{/);
 const luminance=hex=>hex.match(/[a-f\d]{2}/gi).map(channel=>parseInt(channel,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
 const contrast=(foreground,background)=>{const a=luminance(foreground),b=luminance(background);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
 assert.ok(contrast('#FFFEFC','#955568')>=4.5,'primary button text');
 assert.ok(contrast('#352832','#FAF7F4')>=4.5,'main text');
 assert.ok(contrast('#704452','#EEDDE2')>=4.5,'accent text on secondary surface');
 assert.ok(contrast('#655761','#FFFEFC')>=4.5,'muted text');
});

test('split cover scales portraits and retains both navigation actions on small screens',async()=>{
 const css=await fs.readFile(path.resolve('src/components/LandingPage.css'),'utf8');
 assert.match(css,/\.meryo-cover__portrait img\s*\{[^}]*transform:\s*scale\(\.82\)/s);
 assert.match(css,/min-height:\s*clamp\(34rem,\s*calc\(100svh\s*-\s*8rem\),\s*58rem\)/);
 assert.match(css,/min-height:\s*clamp\(15rem,\s*50svh,\s*32rem\)/);
 assert.match(css,/overflow-y:\s*visible/);
 assert.match(css,/@media \(max-width: 370px\)/);
});
