import fs from 'node:fs/promises';import crypto from 'node:crypto';import http from 'node:http';import assert from 'node:assert/strict';import pg from 'pg';import {authorizedWorker} from '../server/push-http.mjs';
if(process.env.GITHUB_ACTIONS!=='true'||process.platform!=='linux')throw Error('Isolated Linux runner only');
const db=new pg.Client({host:'/var/run/postgresql',port:55440,user:process.env.USER,database:'postgres'});await db.connect();let server,phase='bootstrap';const secret=crypto.randomBytes(32).toString('base64url');console.log('::add-mask::'+secret);
try{
 const metadata=JSON.parse(await fs.readFile('db/reference/storage-ci/system-metadata.json','utf8')),schema=await fs.readFile('db/reference/storage-ci/schema.sql','utf8');assert.equal(crypto.createHash('sha256').update(schema).digest('hex'),metadata.sha256);
 for(const role of metadata.roles)if(!(await db.query('select 1 from pg_roles where rolname=$1',[role])).rowCount)await db.query('create role "'+role.replaceAll('"','""')+'" nologin');
 for(const e of metadata.extensionSchemas){await db.query('create schema if not exists "'+e.schema+'"');await db.query('create extension "'+e.name+'" with schema "'+e.schema+'"');}
 await db.query(schema.replace('CREATE SCHEMA public;','CREATE SCHEMA IF NOT EXISTS public;'));
 await db.query('set search_path=public;create extension pg_cron');
 await db.query(await fs.readFile('db/incremental/017_push_dispatch_platform.sql','utf8'));
 let received=0;server=http.createServer((req,res)=>{if(req.url!=='/api/push/worker'||!authorizedWorker(req.headers.authorization,secret)){res.writeHead(401).end();return;}received++;res.writeHead(204).end();});await new Promise(r=>server.listen(54771,'127.0.0.1',r));
 await db.query("insert into meryo_private.push_dispatch_settings values(1,true,'http://127.0.0.1:54771/api/push/worker',$1,null)",[secret]);
 phase='post-commit dispatch';await db.query('begin');await db.query('select meryo_private.wake_push()');await new Promise(r=>setTimeout(r,500));assert.equal(received,0,'pg_net must wait for commit');await db.query('commit');
 async function until(predicate){for(let i=0;i<80;i++){if(predicate())return;await new Promise(r=>setTimeout(r,250));}throw Error('Dispatch did not arrive');}
 await until(()=>received===1);
 phase='cron retry';await db.query("select cron.schedule('meryo-ci-retry','1 second','select meryo_private.wake_push()')");await until(()=>received>=2);
 for(const role of ['anon','authenticated']){
  assert.equal((await db.query("select has_schema_privilege($1,'net','usage') allowed",[role])).rows[0].allowed,false);
  assert.equal((await db.query("select has_function_privilege($1,'meryo_private.wake_push()','execute') allowed",[role])).rows[0].allowed,false);
 }
 console.log(JSON.stringify({officialPgNet:true,postCommitDispatch:true,cronRetry:true,workerSecretVerified:true,clientNetworkAccessDenied:true,dockerUsed:false,productionAccess:false}));
}catch(e){console.error('Failed phase: '+phase);console.error((await db.query("select status_code,error_msg from net._http_response order by id desc limit 3").catch(()=>({rows:[]}))).rows);throw e;}finally{if(server)await new Promise(r=>server.close(r));await db.end();}
