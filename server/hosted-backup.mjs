import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import {encryptBackup,decryptBackup} from './backup-crypto.mjs';

const quote=value=>'"'+value.replaceAll('"','""')+'"';
async function hash(file){const sum=createHash('sha256');for await(const part of createReadStream(file))sum.update(part);return sum.digest('hex');}
export async function hostedBackup({config,storage,key,root,pgBin='',maxBytes=100*1024*1024}){
 if(config.projectRef!=='prdmcjykjpxpcomonwuy'||config.host!=='aws-1-us-east-2.pooler.supabase.com'||config.database!=='postgres'||!config.ssl?.ca||config.ssl.rejectUnauthorized!==true)throw Error('Explicit verified MERYO source required');
 if(storage.url!=='https://prdmcjykjpxpcomonwuy.supabase.co'||key.length!==32)throw Error('Unexpected Storage source or encryption key');
 await fs.mkdir(root,{recursive:true});const work=await fs.mkdtemp(path.join(root,'hosted-work-'));
 const caFile=path.join(work,'supabase-ca.crt');await fs.writeFile(caFile,config.ssl.ca);
 const env={...process.env,PGHOST:config.host,PGPORT:String(config.port),PGDATABASE:config.database,PGUSER:config.user,PGPASSWORD:config.password,PGSSLMODE:'verify-full',PGSSLROOTCERT:caFile};
 const command=(name,args)=>{const exe=pgBin?path.join(pgBin,name+(process.platform==='win32'?'.exe':'')):name;const result=spawnSync(exe,args,{env,encoding:'utf8',windowsHide:true,timeout:300000});if(result.status!==0){fs.writeFile(path.join(work,`${name}-failure.txt`),result.stderr||'command failed').catch(()=>{});throw Error(`${name} failed; archive is not verified (details remain private)`);}return result.stdout;};
 const db=new pg.Client(config);await db.connect();
 try{
  await db.query('begin isolation level repeatable read read only');
  const snapshot=(await db.query('select pg_export_snapshot() snapshot')).rows[0].snapshot;
  const tables=(await db.query("select n.nspname schema,c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and n.nspname in ('public','auth','storage','meryo_private') order by 1,2")).rows;
  const counts={};for(const t of tables){const qualified=`${quote(t.schema)}.${quote(t.name)}`;counts[`${t.schema}.${t.name}`]=(await db.query(`select count(*)::text n from ${qualified}`)).rows[0].n;}
  const objectQuery="select id::text,bucket_id,name,updated_at::text,to_jsonb(o)->>'version' version from storage.objects o order by bucket_id,name";
  const objects=(await db.query(objectQuery)).rows;
  command('pg_dump',['--no-password','--format=custom',`--snapshot=${snapshot}`,`--file=${path.join(work,'database.dump')}`]);
  command('pg_dump',['--no-password','--schema-only',`--snapshot=${snapshot}`,`--file=${path.join(work,'schema.sql')}`]);
  await fs.writeFile(path.join(work,'roles.sql'),command('pg_dumpall',['--no-password','--roles-only','--no-role-passwords']));
  const client=createClient(storage.url,storage.key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:buckets,error:bucketError}=await client.storage.listBuckets();if(bucketError)throw Error('Storage bucket enumeration failed');
  const files={};await fs.mkdir(path.join(work,'objects'));
  let storedBytes=0;
  for(const item of objects){
   const {data,error}=await client.storage.from(item.bucket_id).download(item.name);if(error)throw Error('A Storage object could not be read; backup incomplete');
   storedBytes+=data.size;if(storedBytes>maxBytes)throw Error('Free backup size safety limit exceeded; no paid capacity enabled');
   const file='objects/'+createHash('sha256').update(item.bucket_id+'\0'+item.name).digest('hex');await fs.writeFile(path.join(work,file),Buffer.from(await data.arrayBuffer()));
   files[file]=await hash(path.join(work,file));item.backupFile=file;item.sha256=files[file];item.bytes=data.size;item.contentType=data.type;
  }
  await db.query('commit');
  const after=(await db.query(objectQuery)).rows;
  const before=objects.map(({id,bucket_id,name,updated_at,version})=>({id,bucket_id,name,updated_at,version}));
  if(JSON.stringify(after)!==JSON.stringify(before))throw Error('Storage changed during the snapshot; retry instead of claiming consistency');
  for(const file of ['database.dump','schema.sql','roles.sql','supabase-ca.crt'])files[file]=await hash(path.join(work,file));
  const manifest={createdAt:new Date().toISOString(),projectRef:config.projectRef,scope:'Hosted PostgreSQL dump including Auth and Storage metadata; current Storage objects',counts,buckets,objects,files,limitations:['No historical object versions before this backup','Managed Auth/provider and hosting configuration require separate configuration records','Custom-role passwords excluded','No zero-loss or continuous recovery guarantee']};
  await fs.writeFile(path.join(work,'manifest.json'),JSON.stringify(manifest,null,2));
  const tar=path.join(root,`${Date.now()}-hosted.tar`);const tarResult=spawnSync(process.platform==='win32'?'tar.exe':'tar',['-cf',tar,'-C',work,'.'],{encoding:'utf8',windowsHide:true});if(tarResult.status!==0)throw Error('Archive assembly failed');
  const archive=path.join(root,`${new Date().toISOString().replaceAll(':','-')}.hosted.meryo.enc`);
  try{await encryptBackup(tar,archive,key);const verified=path.join(root,`${Date.now()}-verified.tar`);try{await decryptBackup(archive,verified,key);if(await hash(tar)!==await hash(verified))throw Error('Authenticated backup verification failed');}finally{await fs.rm(verified,{force:true});}}finally{await fs.rm(tar,{force:true});}
  if((await fs.stat(archive)).size>maxBytes)throw Error('Encrypted archive exceeds the free backup safety limit');
  const result={createdAt:manifest.createdAt,archive,work,encrypted:true,downloadVerification:false,restoreVerified:false,objectCount:objects.length,tableCount:tables.length,archiveSha256:await hash(archive),bytes:(await fs.stat(archive)).size};
  await fs.writeFile(path.join(root,'hosted-backup-status.json'),JSON.stringify(result,null,2));
  return result;
 }finally{await db.end();}
}
