import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMeryoApi} from '../src/lib/meryo-api.js';
import {createLocalClient} from '../src/lib/local-client.js';
const origin='http://127.0.0.1:5178';
test('existing MERYO screens: local public catalog and calendar, no fictitious sessions/writes',async t=>{
 const api=createMeryoApi(createLocalClient((url,options)=>fetch(origin+url,options)));
 await t.test('catalog uses actual service IDs, prices and durations from local PostgreSQL',async()=>{
  const shops=await api.catalog();const shop=shops.find(s=>String(s.id)==='900001');assert.ok(shop);assert.equal(String(shop.services[0].id),'900001');assert.equal(shop.services[0].price,30);assert.equal(shop.services[0].duration,'30 min');
  const date=new Date(Date.now()+2*86400000).toISOString().slice(0,10);const slots=await api.slots(shop.id,shop.services[0].id,date);assert.ok(slots.length);assert.ok(slots.every(s=>!Number.isNaN(Date.parse(s.time))));
 });
 await t.test('all previous actor/payment endpoints are closed, including forged headers',async()=>{
  for(const path of ['request','respond','cancel','test-receipt']){const r=await fetch(`${origin}/__local/${path}`,{method:'POST',headers:{'X-Meryo-Test-Actor':'barber','X-Meryo-Local-Only':'1','Content-Type':'application/json'},body:'{}'});assert.equal(r.status,403);}
  assert.equal((await fetch(`${origin}/__local/reservations`,{headers:{'X-Meryo-Test-Actor':'barber'}})).status,403);
  assert.equal((await fetch(`${origin}/tests/browser/reservations.html`)).status,410);
 });
 await t.test('same MERYO entry stays isolated from production and advertises missing Auth honestly',async()=>{
  const page=await fetch(origin);assert.match(page.headers.get('content-security-policy'),/connect-src 'self' ws:\/\/127.0.0.1:5178;/);assert.match(await page.text(),/Falta Supabase Auth de pruebas/);
  const app=await(await fetch(`${origin}/src/App.jsx`)).text();assert.ok(app.includes('/src/lib/supabase.local.js'));
  const management=await(await fetch(`${origin}/src/components/management/Services.jsx`)).text();assert.ok(management.includes('/src/lib/supabase.local.js'));
 });
});
