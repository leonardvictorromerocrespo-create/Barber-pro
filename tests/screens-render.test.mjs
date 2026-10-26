import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

test('existing screens render without a fictitious identity or a payment confirmation',async()=>{
 const output=path.resolve('dist/screen-render/screen.mjs');
 await fs.mkdir(path.dirname(output),{recursive:true});
 await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import App,{BookingModal} from './src/App.jsx';
   export function screen(view){globalThis.window={location:{hash:'#'+view}};try{return renderToStaticMarkup(React.createElement(App));}finally{delete globalThis.window;}}
   export function booking(shop,slots){return renderToStaticMarkup(React.createElement(BookingModal,{selectedShop:shop,selectedService:shop.services[0],selectedDate:'2026-10-27',selectedTime:'',customerInfo:{name:'',phone:''},customRequest:'',customExtra:0,paymentMethod:'Tarjeta',activeSlots:slots,finalPrice:30,requestSaved:false,savingReservation:false,reservationsEnabled:false,agendaLoading:false,agendaError:''}));}`,
   resolveDir:process.cwd(),loader:'jsx'},outfile:output,bundle:true,platform:'node',format:'esm',jsx:'automatic',loader:{'.css':'empty','.png':'dataurl'},external:['react','react-dom/server'],plugins:[{name:'local-only',setup(b){b.onResolve({filter:/^(?:\.\.?\/)+lib\/supabase(?:\.js)?$/},()=>({path:path.resolve('src/lib/supabase.local.js')}));}}]});
 const {screen,booking}=await import(pathToFileURL(output).href);
 assert.match(screen('client-register'),/Crear cuenta/);assert.match(screen('client-login'),/Iniciar sesión/);
 assert.match(screen('barber'),/Acceso barbero/);assert.doesNotMatch(screen('barber'),/Reservas reales/);
 assert.match(screen('admin'),/Iniciar sesión como administrador/);assert.doesNotMatch(screen('admin'),/Barberías registradas/);
 assert.match(screen('shop-manage'),/cuenta de barbero real/);
 assert.match(screen('my-bookings'),/Inicia sesión para consultar tus citas/);
 assert.doesNotMatch(screen('client'),/Este historial es una demostración local|Simular recibo|actor sintético/i);
 const {createMeryoApi}=await import('../src/lib/meryo-api.js');const {createLocalClient}=await import('../src/lib/local-client.js');
 const api=createMeryoApi(createLocalClient((url,options)=>fetch('http://127.0.0.1:5178'+url,options)));
 const shop=(await api.catalog()).find(s=>String(s.id)==='900001');const slots=await api.slots(shop.id,shop.services[0].id,'2026-10-27');
 const html=booking(shop,slots);assert.match(html,/Corte local/);assert.match(html,/30 min/);assert.match(html,/sesión real de cliente/);assert.doesNotMatch(html,/Solicitud guardada para|Simular recibo/);
});
