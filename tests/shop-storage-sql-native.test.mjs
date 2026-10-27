import {test} from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import fs from 'node:fs/promises';import path from 'node:path';import pg from 'pg';import {createClient} from '@supabase/supabase-js';
import {secrets,nativeRoot,realConfig} from '../scripts/setup-real-auth.mjs';
test('Storage metadata/RLS delta only, not an upload-service verification',{skip:process.env.MERYO_REAL_AUTH_TEST!=='1'},async()=>{
 const fixture=JSON.parse(await fs.readFile(path.join(nativeRoot,'shop-operations-accounts.json'),'utf8')),{anonKey}=await secrets();
 const c=createClient('http://127.0.0.1:5178/__supabase',anonKey,{auth:{persistSession:false,autoRefreshToken:false}}),db=new pg.Client(realConfig);
 assert.ifError((await c.auth.signInWithPassword({email:fixture.owner.email,password:fixture.owner.password})).error);
 const token=(await c.auth.getSession()).data.session.access_token,claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url'));
 await db.connect();await db.query('begin');const object=`${fixture.shop}/${crypto.randomUUID()}.jpg`;
 try{
  await db.query('update meryo_private.shop_content_settings set uploads_enabled=true where id=1');
  await db.query("insert into storage.objects(bucket_id,name,owner_id,metadata) values('meryo-shop-content',$1,$2,$3)",[object,fixture.owner.id,JSON.stringify({size:100,mimetype:'image/jpeg'})]);
  await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims)]);await db.query('set local role authenticated');
  const asset=(await db.query("select public.meryo_publicar_archivo($1,'portada','SQL metadata test') id",[object])).rows[0].id;assert.ok(asset);
  await db.query('reset role');await db.query("update public.barberias set estado='pendiente',verificada=false where id=$1",[fixture.shop]);
  await db.query("select set_config('request.jwt.claims','{}',true)");await db.query('set local role anon');
  assert.equal((await db.query('select id from storage.objects where name=$1',[object])).rowCount,0,'Pending content private');
  await db.query('reset role');await db.query("update public.barberias set estado='activa',verificada=true where id=$1",[fixture.shop]);await db.query('set local role anon');
  assert.equal((await db.query('select id from storage.objects where name=$1',[object])).rowCount,1,'Approved published object readable');
  await db.query('reset role');await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({...claims,sub:fixture.stranger.id})]);await db.query('set local role authenticated');await db.query('savepoint cross_shop');
  await assert.rejects(db.query('select public.meryo_retirar_archivo($1)',[asset]),/No autorizado/);await db.query('rollback to savepoint cross_shop');await db.query('reset role');
  await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims)]);await db.query('set local role authenticated');await db.query('select public.meryo_retirar_archivo($1)',[asset]);
  await db.query('reset role');await db.query("select set_config('request.jwt.claims','{}',true)");await db.query('set local role anon');assert.equal((await db.query('select id from storage.objects where name=$1',[object])).rowCount,0);
  await db.query('reset role');assert.equal((await db.query('select id from storage.objects where name=$1',[object])).rowCount,1,'File record retained for recovery');
 }finally{await db.query('rollback');await db.end();await c.auth.signOut({scope:'local'});}
});
