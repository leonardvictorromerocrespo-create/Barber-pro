import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import pg from 'pg';import {execFileSync} from 'node:child_process';
const root=path.join(process.env.LOCALAPPDATA,'MERYO-deployment'),apply=process.argv.includes('--apply-hosted');
const storage=JSON.parse(await fs.readFile(path.join(root,'storage-isolated-proof.json'),'utf8'));
if(!storage.officialStorage||!storage.privateBeforeApproval||!storage.crossTenantDenied||!storage.serverMfaApproval||storage.productionAccess!==false)throw Error('Real isolated Storage proof required');
const source=await fs.readFile('db/incremental/015_enable_verified_content.sql','utf8'),sha256=crypto.createHash('sha256').update(source).digest('hex');
const config=apply?JSON.parse(await fs.readFile(path.join(root,'hosted-source.json'),'utf8')):{host:'127.0.0.1',port:55440,user:'meryo_test_admin',database:'meryo_auth_local'};
if(apply){
 const rehearsal=JSON.parse(await fs.readFile(path.join(root,'block-015-rehearsal.json'),'utf8')),remote=JSON.parse(await fs.readFile(path.join(root,'drive-hosted-proof.json'),'utf8'));
 if(rehearsal.sha256!==sha256||!rehearsal.rolledBack||!remote.independentDownloadRestored||!remote.downloadHashVerified||remote.pcRequired!==false||remote.storageObjects!==0||remote.tables<66||Date.now()-Date.parse(remote.verifiedAt)>3600000)throw Error('Matching rehearsal and fresh independent hosted restore required; nonempty Storage requires a renewed object-consistency check');
 const run=JSON.parse(execFileSync('gh',['run','view',String(remote.runId),'--json','conclusion,headSha'],{encoding:'utf8'}));
 if(run.conclusion!=='success'||run.headSha!==remote.headSha)throw Error('Cloud backup success must be verified directly');
 if(config.projectRef!=='prdmcjykjpxpcomonwuy'||config.host!=='aws-1-us-east-2.pooler.supabase.com'||config.ssl?.rejectUnauthorized!==true)throw Error('Wrong hosted destination');
}
const db=new pg.Client(config);await db.connect();
try{
 await db.query('begin');await db.query("set local lock_timeout='10s';select pg_advisory_xact_lock(hashtextextended('meryo-operations-release',0))");
 const before=(await db.query("select md5(coalesce(jsonb_agg(to_jsonb(b) order by id),'[]'::jsonb)::text) shops from public.barberias b")).rows[0].shops;
 if(apply&&(await db.query("select count(*)::int n from storage.objects")).rows[0].n!==0)throw Error('Storage changed after the empty-source backup; refresh and recheck before activation');
 await db.query(source.replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,''));
 const gates=(await db.query("select (public.meryo_contenido_config()->>'uploads_enabled')::boolean uploads,(public.meryo_reservas_config()->>'cobros_habilitados')::boolean payments,public.es_admin() admin_without_session,has_column_privilege('authenticated','public.profiles','rol','update') may_change_role")).rows[0];
 if(!gates.uploads||gates.payments||gates.admin_without_session||gates.may_change_role)throw Error('Unexpected security or payment gate');
 if((await db.query("select md5(coalesce(jsonb_agg(to_jsonb(b) order by id),'[]'::jsonb)::text) shops from public.barberias b")).rows[0].shops!==before)throw Error('Existing shop rows changed');
 if(apply){await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',['20261027000515','meryo_verified_content',[source]]);await db.query('commit');}else await db.query('rollback');
 const proof={at:new Date().toISOString(),sha256,productionApplied:apply,rolledBack:!apply,gates,existingShopsPreserved:true};await fs.writeFile(path.join(root,`block-015-${apply?'applied':'rehearsal'}.json`),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(e){await db.query('rollback');console.error('Content activation rolled back: '+e.message);process.exitCode=1;}finally{await db.end();}
