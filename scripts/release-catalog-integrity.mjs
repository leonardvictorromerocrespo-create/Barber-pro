// Explicit owner-authorized catalogue correction. Default: restored-copy rollback rehearsal.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {encryptBackup,decryptBackup} from '../server/backup-crypto.mjs';
const root=path.join(process.env.LOCALAPPDATA,'MERYO-deployment');
const apply=process.argv.includes('--apply-hosted');
const restore=JSON.parse(await fs.readFile(path.join(root,'backups','hosted-restore-status.json'),'utf8'));
const file='011_catalog_integrity.sql';
const source=await fs.readFile(path.join('db','incremental',file),'utf8');
const hash=value=>createHash('sha256').update(value).digest('hex');
const sha256=hash(source),strip=sql=>sql.replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,'');
const config=apply?JSON.parse(await fs.readFile(path.join(root,'hosted-source.json'),'utf8')):{host:'127.0.0.1',port:55440,user:'meryo_test_admin',database:restore.database};
if(apply){
 if(config.projectRef!=='prdmcjykjpxpcomonwuy'||config.host!=='aws-1-us-east-2.pooler.supabase.com'||config.user!=='postgres.prdmcjykjpxpcomonwuy'||config.ssl?.rejectUnauthorized!==true)throw Error('Wrong destination');
 const proof=JSON.parse(await fs.readFile(path.join(root,'catalog-rehearsal.json'),'utf8'));
 if(proof.sha256!==sha256||!proof.rolledBack||!proof.checksPassed)throw Error('Matching restored-copy rehearsal required');
 const independent=JSON.parse(await fs.readFile(path.join(root,'external-backup-status.json'),'utf8'));
 if(!independent.downloadedArchiveRestored||restore.tableCountsVerified<47)throw Error('Verified independent restore required');
}else if(config.host!=='127.0.0.1'||!/^meryo_restore_hosted_\d+$/.test(config.database))throw Error('Only existing restored database');
const db=new pg.Client(config);await db.connect();
const snapshot=async()=>{
 const result={};
 for(const table of ['barberias','profiles','resenas','servicios','horarios','reservas','pagos','barberia_media'])result[table]=(await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) rows from public.${table} t`)).rows[0].rows;
 return JSON.stringify(result);
};
try{
 await db.query('begin');await db.query("set local lock_timeout='10s';set local statement_timeout='60s';select pg_advisory_xact_lock(hashtextextended('meryo-catalog-integrity',0))");
 // The restored pre-release archive intentionally predates migrations 001-010.
 if(!apply&&!(await db.query("select to_regclass('meryo_private.launch_settings') found")).rows[0].found){
  const preflight=JSON.parse(await fs.readFile(path.join(root,'backups','migration-preflight.json'),'utf8'));
  for(const item of preflight.files){const sql=await fs.readFile(path.join('db','incremental',item.file),'utf8');if(hash(sql)!==item.sha256)throw Error('Baseline changed');await db.query(strip(sql));}
 }
 await db.query('select id from public.barberias where id in (1,5,6,7,8) for update');
 const before=await snapshot();
 let backup=null;
 if(apply){
  const stamp=Date.now(),plain=path.join(root,`catalog-before-${stamp}.json`),check=path.join(root,`catalog-check-${stamp}.json`);
  backup=path.join(root,'backups',`catalog-before-${stamp}.json.enc`);
  const key=await fs.readFile(path.join(process.env.LOCALAPPDATA,'MERYO-backups','recovery','backup.key'));
  try{await fs.writeFile(plain,before,{flag:'wx',mode:0o600});await encryptBackup(plain,backup,key);await decryptBackup(backup,check,key);if(hash(await fs.readFile(check))!==hash(before))throw Error('Snapshot recovery mismatch');}
  finally{key.fill(0);await fs.rm(plain,{force:true});await fs.rm(check,{force:true});}
 }
 await db.query(strip(source));
 if(await snapshot()!==before)throw Error('Existing business records changed');
 const check=async(condition,message)=>{if(!condition)throw Error(message);};
 for(const role of ['anon','authenticated']){
  await db.query(`set local role ${role}`);
  await check((await db.query('select public.meryo_catalogo_publico() data')).rows[0].data.length===0,'Public catalogue must be empty');
  await check((await db.query('select id from public.barberias where id in (1,5,6,7,8)')).rowCount===0,'Raw API exposes demos');
  await db.query('reset role');
 }
 await check((await db.query('select count(*)::integer n from meryo_private.catalog_exclusions')).rows[0].n===5,'Wrong exclusions');
 if(!apply){
  await db.query('savepoint real_shop');
  // Same name, different ID: proves that real approvals are not excluded by name.
  await db.query("insert into public.barberias(id,nombre,estado,verificada,rating,total_resenas) overriding system value values(999999991,'BarberFlax','activa',true,5,324)");
  await db.query('set local role anon');
  const rows=(await db.query('select public.meryo_catalogo_publico() data')).rows[0].data;
  await check(rows.length===1&&rows[0].id===999999991&&rows[0].rating===null&&rows[0].total_resenas===0,'Real-shop or review isolation failed');
  await db.query('reset role');await db.query('rollback to savepoint real_shop');
 }
 if(await snapshot()!==before)throw Error('Original records not preserved');
 if(apply){
  await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',['20261027000111','meryo_011_catalog_integrity',[source]]);
  await db.query('commit');
 }else await db.query('rollback');
 const result={at:new Date().toISOString(),sha256,checksPassed:true,rolledBack:!apply,productionApplied:apply,excludedIds:[1,5,6,7,8],originalRecordsUnchanged:true,backup};
 await fs.writeFile(path.join(root,apply?'catalog-applied.json':'catalog-rehearsal.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}catch(error){await db.query('rollback');console.error('Catalogue correction rolled back: '+error.message);process.exitCode=1;}
finally{await db.end();}
