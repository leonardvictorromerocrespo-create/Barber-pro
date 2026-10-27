// Existing native environment only. Recovered Storage SQL metadata is not a Storage API.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import pg from 'pg';
const root=path.join(process.env.LOCALAPPDATA,'MERYO-deployment');
const restored=JSON.parse(await fs.readFile(path.join(root,'backups','hosted-restore-status.json'),'utf8'));
if(!/^meryo_restore_hosted_\d+$/.test(restored.database))throw Error('Unexpected restored source');
const config={host:'127.0.0.1',port:55440,user:'meryo_test_admin',database:'meryo_auth_local'};
const db=new pg.Client(config);await db.connect();
const strip=sql=>sql.replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,'');
try{
 await db.query('begin');
 if(!(await db.query("select to_regclass('storage.objects') found")).rows[0].found){
  const dump=spawnSync('C:/Program Files/PostgreSQL/17/bin/pg_dump.exe',['--host=127.0.0.1','--port=55440','--username=meryo_test_admin',`--dbname=${restored.database}`,'--schema-only','--schema=storage','--no-owner','--no-acl'],{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});
  if(dump.status!==0)throw Error('Cannot read recovered Storage SQL');
  // psql-only restrict directives are not SQL. No rows, service or object files are created.
  await db.query(dump.stdout.replace(/^\\.*$/gm,''));
  await db.query('grant usage on schema storage to anon,authenticated; grant select on storage.objects to anon,authenticated; grant insert on storage.objects to authenticated;');
 }
 if(!(await db.query("select to_regprocedure('public.meryo_catalogo_publico()') found")).rows[0].found){
  let sql=await fs.readFile('db/incremental/011_catalog_integrity.sql','utf8');
  const start=sql.indexOf('-- Owner explicitly confirmed'),end=sql.indexOf('create function public.meryo_barberia_publicable');
  if(start<0||end<start)throw Error('Unexpected 011 boundaries');
  // Production IDs cannot classify unrelated local fixture rows. Same security/catalog DDL.
  sql=sql.slice(0,start)+sql.slice(end);await db.query(strip(sql));
 }
 if(!(await db.query("select to_regprocedure('public.meryo_guardar_perfil(jsonb)') found")).rows[0].found)await db.query(strip(await fs.readFile('db/incremental/012_shop_operations.sql','utf8')));
 await db.query("notify pgrst,'reload schema'");await db.query('commit');
 console.log(JSON.stringify({database:config.database,existingAuthAndPostgrest:true,storageSQLOnly:true,storageHTTPAvailable:false,productionTouched:false}));
}catch(e){await db.query('rollback');console.error('Local migration rolled back: '+e.message);process.exitCode=1;}
finally{await db.end();}
