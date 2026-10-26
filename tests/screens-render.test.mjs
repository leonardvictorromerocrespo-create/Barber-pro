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
 assert.match(screen('account-security'),/Iniciar sesión para proteger mi cuenta/);
 assert.doesNotMatch(screen('client'),/Este historial es una demostración local|Simular recibo|actor sintético/i);
 const shop={id:1,name:'Barbería',services:[{id:1,name:'Corte local',duration:'30 min',price:30}]};
 const html=booking(shop,[]);assert.match(html,/Corte local/);assert.match(html,/30 min/);assert.match(html,/continúa con Google/);
 assert.match(html,/Solicitar cita/);assert.match(html,/hasta 15 minutos/);assert.match(html,/Barbero/);
 assert.doesNotMatch(html,/Reservas en preparación|Costo adicional|Sin extra|Tarjeta|Yape|Plin|Simular recibo/);

});
