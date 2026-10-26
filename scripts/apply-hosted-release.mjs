// Explicit, authorized release only. Atomic SQL; no candidate schema or test fixtures.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import pg from 'pg';
const root=path.join(process.env.LOCALAPPDATA,'MERYO-deployment');
const restore=JSON.parse(await fs.readFile(path.join(root,'backups','hosted-restore-status.json'),'utf8'));
const preflight=JSON.parse(await fs.readFile(path.join(root,'backups','migration-preflight.json'),'utf8'));
const apply=process.argv.includes('--apply-hosted');
if(!restore.archive.endsWith('.hosted.meryo.enc')||restore.tableCountsVerified<47)throw Error('Verified hosted restore required');
const hosted=JSON.parse(await fs.readFile(path.join(root,'hosted-source.json'),'utf8'));
if(hosted.projectRef!=='prdmcjykjpxpcomonwuy'||hosted.host!=='aws-1-us-east-2.pooler.supabase.com'||hosted.user!=='postgres.prdmcjykjpxpcomonwuy'||hosted.ssl.rejectUnauthorized!==true)throw Error('Wrong hosted destination');
const config=apply?hosted:{host:'127.0.0.1',port:55440,user:'meryo_test_admin',database:restore.database};
if(!apply&&!/^meryo_restore_hosted_\d+$/.test(config.database))throw Error('Only the restored copy may be used for rehearsal');
if(apply){const proof=JSON.parse(await fs.readFile(path.join(root,'external-backup-status.json'),'utf8'));if(proof.runId!==40383813693||!proof.downloadedArchiveRestored)throw Error('Independent backup download/restore required');}
const files=[];
for(const item of preflight.files){
 const sql=await fs.readFile(path.join('db','incremental',item.file),'utf8');
 if(createHash('sha256').update(sql).digest('hex')!==item.sha256)throw Error('Migration changed since its restored-schema preflight');
 files.push({...item,sql:sql.replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,'')});
}
if(files.length!==10)throw Error('Unexpected release manifest');
const db=new pg.Client(config);await db.connect();
try{
 await db.query('begin');await db.query("set local lock_timeout='10s'; set local statement_timeout='60s'; select pg_advisory_xact_lock(hashtextextended('meryo-release-20261026',0))");
 const protectedTables=['profiles','barberias','servicios','horarios','reservas','pagos','resenas','barberia_media','reservas_legacy'];
 const before={};for(const table of protectedTables)before[table]=(await db.query(`select count(*)::text n from public.${table}`)).rows[0].n;
 const history=(await db.query('select version from supabase_migrations.schema_migrations order by version')).rows.map(r=>r.version);
 for(let i=0;i<files.length;i++){
  const file=files[i],version='202610262200'+String(i+1).padStart(2,'0');
  if((await db.query('select 1 from supabase_migrations.schema_migrations where version=$1',[version])).rowCount)throw Error('Release version already present; do not apply twice');
  await db.query(file.sql);
  await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[version,'meryo_'+file.file.replace(/\.sql$/,''),[`-- sha256: ${file.sha256}\n${file.sql}`]]);
 }
 await db.query("update meryo_private.launch_settings set reservas_habilitadas=true,entorno='production',plazo_pago_segundos=600,pagos_habilitados=false,push_envio_habilitado=false where id=1");
 for(const table of protectedTables)if((await db.query(`select count(*)::text n from public.${table}`)).rows[0].n!==before[table])throw Error('Protected row counts changed');
 const retained=(await db.query('select version from supabase_migrations.schema_migrations where version=any($1::text[]) order by version',[history])).rows.map(r=>r.version);
 if(JSON.stringify(retained)!==JSON.stringify(history))throw Error('Previous migration history changed');
 const settings=(await db.query('select public.meryo_reservas_config() settings')).rows[0].settings;
 if(settings.respuesta_segundos!==900||settings.plazo_pago_segundos!==600||settings.modelo_comercial!=='mensualidad'||settings.cobros_habilitados!==false)throw Error('Wrong commercial or booking settings');
 const security=(await db.query("select public.es_admin() is_admin_without_claims,has_table_privilege('authenticated','public.profiles','truncate') may_truncate,has_column_privilege('authenticated','public.profiles','rol','update') may_change_role,has_function_privilege('authenticated','public.pagar_reserva_prueba(uuid,text)','execute') may_simulate_payment")).rows[0];
 if(Object.values(security).some(Boolean))throw Error('Release security gate failed');
 if(apply){await db.query("notify pgrst, 'reload schema'");await db.query('commit');}else await db.query('rollback');
 const result={at:new Date().toISOString(),productionApplied:apply,rehearsalRolledBack:!apply,database:config.database,migrations:files.map(f=>({file:f.file,sha256:f.sha256})),protectedCounts:before,previousHistoryPreserved:true,settings,security};
 await fs.writeFile(path.join(root,apply?'release-applied.json':'release-rehearsal.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({productionApplied:apply,rehearsalRolledBack:!apply,migrations:files.length,previousHistoryPreserved:true,settings,security}));
}catch(error){await db.query('rollback');console.error('Release rolled back: '+error.message);process.exitCode=1;}
finally{await db.end();}
