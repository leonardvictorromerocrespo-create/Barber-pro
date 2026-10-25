import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createLocalPool,checkLocalTarget,localIds} from '../server/local-db.mjs';
const origin='http://127.0.0.1:5178';
async function call(path,actor='client',body,extra={}){
 const response=await fetch(`${origin}/__local/${path}`,{method:body?'POST':'GET',redirect:'error',headers:{'Content-Type':'application/json','X-Meryo-Test-Actor':actor,'X-Meryo-Local-Only':'1',...extra},...(body?{body:JSON.stringify(body)}:{})});
 return {status:response.status,data:await response.json()};
}
test('localhost HTTP path: isolated MERYO assets and PostgreSQL booking flow',async t=>{
 const pool=createLocalPool();
 try{
  await checkLocalTarget(pool);
  const day=new Date(Date.now()+4*86400000).toISOString().slice(0,10);
  const agenda=(await call(`agenda?day=${day}`)).data;
  assert.ok(agenda.length>=4,'Need available synthetic slots');
  await t.test('headers block remote services and local entry omits the production client',async()=>{
    const page=await fetch(origin);const csp=page.headers.get('content-security-policy');
    assert.ok(csp.includes("connect-src 'self' ws://127.0.0.1:5178;"));assert.ok(!csp.includes('https:'));
    assert.ok((await page.text()).includes('PRUEBAS LOCALES'));
    const appSource=await (await fetch(`${origin}/src/App.jsx`)).text();
    assert.ok(appSource.includes('/src/lib/supabase.local.js'));
    const remoteId=/https:\/\/([a-z0-9]+)\.supabase\.co/.exec(await fs.readFile('src/lib/supabase.js','utf8'))?.[1];
    assert.ok(remoteId);assert.ok(!appSource.includes(remoteId));
    const bad=await call('request','client',{start:agenda[0].hora_inicio},{Origin:'https://foreign.example'});assert.equal(bad.status,403);
  });
  await t.test('request → manual acceptance → local verified receipt, no money charged',async()=>{
    const request=await call('request','client',{start:agenda[0].hora_inicio});assert.equal(request.status,200);
    const id=request.data.id;
    const before=await call('test-receipt','client',{id});assert.equal(before.status,400);
    const wrong=await call('respond','otherBarber',{id,accept:true});assert.equal(wrong.status,400);
    const hidden=await call('reservations','otherClient');assert.ok(!hidden.data.some(r=>r.id===id));
    assert.equal((await call('respond','barber',{id,accept:true})).data.estado,'aceptada');
    const receipt=await call('test-receipt','client',{id});assert.equal(receipt.status,200);
    assert.deepEqual(receipt.data,{estado:'confirmada',simulated:true,charged:false});
    const {rows:[r]}=await pool.query('select r.estado,r.monto_adelanto,p.proveedor from public.reservas r join public.pagos p on p.reserva_id=r.id where r.id=$1',[id]);
    assert.equal(r.estado,'confirmada');assert.equal(Number(r.monto_adelanto),15);assert.equal(r.proveedor,'localhost-fixture');
  });
  await t.test('HTTP simultaneous requests preserve one winner and rejection releases the slot',async()=>{
    const results=await Promise.all([call('request','client',{start:agenda[1].hora_inicio}),call('request','otherClient',{start:agenda[1].hora_inicio})]);
    assert.equal(results.filter(r=>r.status===200).length,1);
    const id=results.find(r=>r.status===200).data.id;
    assert.equal((await call('respond','barber',{id,accept:false})).data.estado,'rechazada');
    const next=await call('request','client',{start:agenda[1].hora_inicio});assert.equal(next.status,200);
    assert.equal((await call('cancel','client',{id:next.data.id})).status,200);
  });
  await t.test('server timer releases an expired local fixture with no browser involved',async()=>{
    const r=await call('request','client',{start:agenda[2].hora_inicio});assert.equal(r.status,200);
    // Move only the fixture just created by this test, not any pre-existing record.
    await pool.query("update public.reservas set expira_respuesta_en=clock_timestamp()-interval '1 second' where id=$1 and cliente_id=$2",[r.data.id,localIds.client]);
    let state;
    for(let i=0;i<8;i++){
      ({rows:[{estado:state}]}=await pool.query('select estado from public.reservas where id=$1',[r.data.id]));
      if(state==='expirada')break;
      await new Promise(resolve=>setTimeout(resolve,300));
    }
    assert.equal(state,'expirada');
  });
 }finally{await pool.end();}
});
