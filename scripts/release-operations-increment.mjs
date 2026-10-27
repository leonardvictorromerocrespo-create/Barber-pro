// Explicit block releases after native UI/API proof and a matching restored backup.
import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import pg from 'pg';
const root=path.join(process.env.LOCALAPPDATA,'MERYO-deployment'),block=process.argv.find(v=>/^01[34]$/.test(v)),apply=process.argv.includes('--apply-hosted');
const releases={'013':{file:'013_admin_records.sql',proof:'admin-records-ui-proof.json',gate:'public.meryo_admin_usuarios(text,text,text,integer)'},'014':{file:'014_team_scheduling.sql',proof:'team-scheduling-ui-proof.json',gate:'public.meryo_equipo()'}};
if(!block||!releases[block])throw Error('Explicit supported block required');const release=releases[block];
const restore=JSON.parse(await fs.readFile(path.join(root,'backups','hosted-restore-status.json'),'utf8')),backup=JSON.parse(await fs.readFile(path.join(root,'backups','hosted-backup-status.json'),'utf8'));
if(restore.archive!==path.basename(backup.archive)||restore.tableCountsVerified<60)throw Error('Matching recovered production backup required');
const source=await fs.readFile(path.join('db','incremental',release.file),'utf8'),sha256=createHash('sha256').update(source).digest('hex');
const config=apply?JSON.parse(await fs.readFile(path.join(root,'hosted-source.json'),'utf8')):{host:'127.0.0.1',port:55440,user:'meryo_test_admin',database:restore.database};
if(apply){
 if(config.projectRef!=='prdmcjykjpxpcomonwuy'||config.host!=='aws-1-us-east-2.pooler.supabase.com'||config.user!=='postgres.prdmcjykjpxpcomonwuy'||config.ssl?.rejectUnauthorized!==true)throw Error('Wrong hosted source');
 const proof=JSON.parse(await fs.readFile(path.join(root,`block-${block}-rehearsal.json`),'utf8')),ui=JSON.parse(await fs.readFile(path.join(root,release.proof),'utf8'));
 if(proof.sha256!==sha256||!proof.rolledBack||!ui.completed||ui.productionTestData!==false)throw Error('Matching rehearsal and genuine native UI proof required');
}else if(config.host!=='127.0.0.1'||!/^meryo_restore_hosted_\d+$/.test(config.database))throw Error('Only existing restored copy');
const db=new pg.Client(config);await db.connect();const columns={};
async function fingerprint(){const out={};for(const table of ['profiles','barberias','servicios','horarios','bloqueos','reservas','pagos','resenas','barberia_media']){
 if(!columns[table])columns[table]=(await db.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position",[table])).rows.map(r=>r.column_name);
 const select=columns[table].map(c=>'"'+c.replaceAll('"','""')+'"').join(',');out[table]=(await db.query(`select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text) value from (select ${select} from public.${table}) t`)).rows[0].value;
}return JSON.stringify(out);}
try{
 await db.query('begin');await db.query("set local lock_timeout='10s';set local statement_timeout='90s';select pg_advisory_xact_lock(hashtextextended('meryo-operations-release',0))");
 const before=await fingerprint();
 await db.query(source.replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,''));
 if(await fingerprint()!==before)throw Error('Existing records changed');
 const security=(await db.query("select public.es_admin() admin_without_claims, (public.meryo_reservas_config()->>'cobros_habilitados')::boolean payments, (public.meryo_contenido_config()->>'uploads_enabled')::boolean uploads,has_column_privilege('authenticated','public.profiles','rol','update') may_change_role")).rows[0];
 if(Object.values(security).some(Boolean))throw Error('Security gate changed');
 if((await db.query('select has_function_privilege($1,$2,$3) allowed',['anon',release.gate,'execute'])).rows[0].allowed)throw Error('Anonymous access exposed');
 if(apply){await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',['20261027000'+(block==='013'?'313':'414'),'meryo_'+release.file.replace('.sql',''),[source]]);await db.query('commit');}else await db.query('rollback');
 const result={at:new Date().toISOString(),sha256,block,productionApplied:apply,rolledBack:!apply,existingRecordsPreserved:true,backupArchive:restore.archive,security};
 await fs.writeFile(path.join(root,`block-${block}-${apply?'applied':'rehearsal'}.json`),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(e){await db.query('rollback');console.error('Block rolled back: '+e.message);process.exitCode=1;}finally{await db.end();}
