import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

test('notification invitation and owner request notice render with accessible, correct destinations',async()=>{
 const output=path.resolve('dist/owner-notification-ui/render.mjs');
 await fs.mkdir(path.dirname(output),{recursive:true});
 await build({
  stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {NotificationOffer,OwnerBookingNotice} from './src/components/NotificationAccess.jsx';export const offer=()=>renderToStaticMarkup(React.createElement(NotificationOffer,{onAccept:()=>{},onReject:()=>{}}));export const ownerNotice=()=>renderToStaticMarkup(React.createElement(OwnerBookingNotice,{notice:{id:42,titulo:'Nueva solicitud de reserva',mensaje:'Un cliente solicita un corte.',tipo:'reserva_solicitada',reserva_id:'00000000-0000-4000-8000-000000000042'},onDismiss:()=>{}}));`,resolveDir:process.cwd(),loader:'jsx'},
  outfile:output,bundle:true,format:'esm',platform:'node',jsx:'automatic',external:['react','react-dom/server'],loader:{'.css':'empty'},
 });
 const {offer,ownerNotice}=await import(pathToFileURL(output).href);
 const invitation=offer(),notice=ownerNotice();
 assert.match(invitation,/Activar notificaciones/);
 assert.match(invitation,/Recibe avisos cuando llegue una nueva solicitud de cita/);
 assert.match(invitation,/>Aceptar</);assert.match(invitation,/>Rechazar</);
 assert.match(invitation,/meryo-notification-offer/);
 assert.match(notice,/Un cliente solicita un corte/);
 assert.ok(notice.includes('href="/?cita=00000000-0000-4000-8000-000000000042#my-bookings"'));
});

test('push invitation respects reduced motion and the dismissed choice remains account-specific',async()=>{
 const css=await fs.readFile(path.resolve('src/components/NotificationAccess.css'),'utf8');
 const component=await fs.readFile(path.resolve('src/components/NotificationAccess.jsx'),'utf8');
 const app=await fs.readFile(path.resolve('src/App.jsx'),'utf8');
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
 assert.match(component,/deferPushOffer\(storage\(\),id\)/);
 assert.match(component,/pushOfferDeferred\(storage\(\),id\)/);
 assert.match(component,/api\.notifications\(id\)/);
 assert.match(component,/visiblePolling/);
 assert.doesNotMatch(app,/cargarNotificaciones|setNotificaciones|setUltimaNoti/);
});
