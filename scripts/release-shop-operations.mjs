// Atomic authorized block release. Default is a rollback rehearsal on the restored archive.
import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import pg from 'pg';
const root=path.join(process.env.LOCALAPPDATA,'MERYO-deployment'),apply=process.argv.includes('--apply-hosted');
const restored=JSON.parse(await fs.readFile(path.join(root,'backups','hosted-restore-status.json'),'utf8'));
const backup=JSON.parse(await fs.readFile(path.join(root,'backups','hosted-backup-status.json'),'utf8'));
if(restored.archive!==path.basename(backup.archive)||restored.tableCountsVerified<56||restored.storageObjects!==0)throw Error('A matching fresh restored backup is required; review changed Storage coverage before releasing');
const source=await fs.readFile('db/incremental/012_shop_operations.sql','utf8'),sha256=createHash('sha256').update(source).digest('hex');
const config=apply?JSON.parse(await fs.readFile(path.join(root,'hosted-source.json'),'utf8')):{host:'127.0.0.1',port:55440,user:'meryo_test_admin',database:restored.database};
if(apply){
 if(config.projectRef!=='prdmcjykjpxpcomonwuy'||config.user!=='postgres.prdmcjykjpxpcomonwuy'||config.host!=='aws-1-us-east-2.pooler.supabase.com'||config.ssl?.rejectUnauthorized!==true)throw Error('Wrong hosted destination');
 const proof=JSON.parse(await fs.readFile(path.join(root,'shop-operations-rehearsal.json'),'utf8'));
 if(proof.sha256!==sha256||!proof.rolledBack)throw Error('Matching rehearsal required');
 const ui=JSON.parse(await fs.readFile(path.join(root,'shop-operations-ui-proof.json'),'utf8'));
 if(!ui.registration||!ui.preparation||!ui.adminMfa||!ui.approval||!ui.publicProfile||!ui.ownerUpdate||ui.productionTestData)throw Error('Completed native UI walkthrough required');
}else if(config.host!=='127.0.0.1'||!/^meryo_restore_hosted_\d+$/.test(config.database))throw Error('Only existing restored copy');
const db=new pg.Client(config);await db.connect();
async function fingerprint(){const out={};for(const table of ['barberias','profiles','servicios','horarios','reservas','pagos','resenas','barberia_media'])out[table]=(await db.query(`select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text) hash from public.${table} t`)).rows[0].hash;return JSON.stringify(out);}
try{
 await db.query('begin');await db.query("set local lock_timeout='10s';set local statement_timeout='60s';select pg_advisory_xact_lock(hashtextextended('meryo-shop-operations-release',0))");
 const before=await fingerprint();
 await db.query(source.replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,''));
 if(before!==await fingerprint())throw Error('Existing business records changed');
 const gate=(await db.query("select (public.meryo_contenido_config()->>'uploads_enabled')::boolean uploads,has_column_privilege('authenticated','public.barberias','nombre','update') direct_profile_update,public.es_admin() admin_without_mfa")).rows[0];
 if(Object.values(gate).some(Boolean))throw Error('Security gate failed');
 await db.query('set local role anon');
 if((await db.query('select public.meryo_catalogo_publico() data')).rows[0].data.length!==0)throw Error('Unexpected commercial catalogue; review actual new approvals first');
 await db.query('reset role');
 if((await db.query('select count(*)::int n from meryo_private.catalog_exclusions where active')).rows[0].n!==5)throw Error('Demo classification changed');
 if(apply){await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',['20261027000212','meryo_012_shop_operations',[source]]);await db.query('commit');}else await db.query('rollback');
 const result={at:new Date().toISOString(),sha256,rolledBack:!apply,productionApplied:apply,existingRecordsUnchanged:true,uploadsEnabled:false,backupArchive:restored.archive,restoredDatabase:restored.database};
 await fs.writeFile(path.join(root,apply?'shop-operations-applied.json':'shop-operations-rehearsal.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(e){await db.query('rollback');console.error('Shop operations rolled back: '+e.message);process.exitCode=1;}finally{await db.end();}
