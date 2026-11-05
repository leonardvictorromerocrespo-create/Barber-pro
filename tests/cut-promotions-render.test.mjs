import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

test('Cortes al 50 % renders real server offer fields and explicit empty/loading states', async () => {
  const output = path.resolve('dist/cut-promotions-render/view.mjs');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await build({
    stdin: { contents: `import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {CutPromotions} from './src/components/CutPromotions.jsx';import LandingPage from './src/components/LandingPage.jsx';import {BookingModal} from './src/App.jsx';
      export const page=(offers,loading=false,error='')=>renderToStaticMarkup(React.createElement(CutPromotions,{offers,loading,error,onRetry(){},onBack(){},onOpenOffer(){},onNavigate(){},heroImage:'/existing-barber-hero.jpg',bannerImage:'/promotion-only.png'}));
      export const cover=()=>renderToStaticMarkup(React.createElement(LandingPage,{setView(){},onExplore(){},onPromotions(){},onSignIn(){},onAccount(){},onProfessionalAccess(){}}));
      export const booking=()=>renderToStaticMarkup(React.createElement(BookingModal,{catalogCategory:'barberia',selectedShop:{id:1,name:'Barbería real',services:[{id:5,name:'Corte clásico',price:40,duration:'45 min',bookable:true}],equipo:[{id:'member',nombre:'Profesional',servicios:[5]}]},selectedService:{id:5,name:'Corte clásico',price:40,duration:'45 min',bookable:true},selectedBarber:'member',selectedDate:'2026-11-08',selectedTime:'',customerInfo:{name:'',phone:''},customRequest:'',activeSlots:[],finalPrice:20,promotion:{campaignId:'campaign',regularPrice:40,promoPrice:20},promotionError:'',onRegularPrice(){},onBackToOffers(){},requestSaved:false,savingReservation:false,reservationsEnabled:false,agendaLoading:false,agendaError:''}));`, resolveDir: process.cwd(), loader: 'jsx' },
    outfile: output, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic',
    external: ['react', 'react-dom/server'], loader: { '.css': 'empty', '.png': 'dataurl', '.webp': 'file' },
    plugins: [{ name: 'local-only', setup(buildContext) { buildContext.onResolve({ filter: /^(?:\.\.?\/)+lib\/supabase(?:\.js)?$/ }, () => ({ path: path.resolve('src/lib/supabase.local.js') })); } }],
  });
  const { page, cover, booking } = await import(pathToFileURL(output).href);
  const offer = { campaign_id: 'campaign', shop_id: 14, shop_name: 'Barbería real', district: 'Ate Vitarte', service_id: 5, service_name: 'Corte clásico', regular_price: 40, promo_price: 20, duration_min: 45, starts_on: '2026-11-08', ends_on: '2026-11-10', slots: [{ date: '2026-11-08', label: '14:00' }] };
  const markup = page([offer]);
  assert.match(cover(), />Ver promociones<\/button>/);
  assert.match(markup, /Cortes al 50 %/);
  assert.match(markup, /promotion-only\.png/);
  assert.match(markup, /src="\/existing-barber-hero\.jpg"/);
  assert.match(markup, /Barbería real/);
  assert.match(markup, /S\/ 40\.00/);
  assert.match(markup, /S\/ 20\.00/);
  assert.match(markup, /No incluye barba sola, tintes ni paquetes/);
  assert.match(markup, /Ver horarios/);
  assert.doesNotMatch(markup, /Barbería Norte|Estudio Filo/);
  assert.match(page([], false), /No hay promociones disponibles ahora/);
  assert.match(page([], true), /Buscando turnos promocionales/);
  const bookingMarkup = booking();
  assert.match(bookingMarkup, /Precio promocional/);
  assert.match(bookingMarkup, /S\/ 20\.00/);
  assert.match(bookingMarkup, /Ver otros horarios al precio habitual S\/ 40\.00/);
});
