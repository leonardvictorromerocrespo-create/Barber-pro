// Restore the authenticated hosted archive into the EXISTING local PG cluster only.
// Never uses a hosted connection and never replaces an existing database.
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import pg from 'pg';
import {decryptBackup} from '../server/backup-crypto.mjs';
const cloud=process.env.GITHUB_ACTIONS==='true';
const root=cloud?process.env.MERYO_BACKUP_ROOT:path.join(process.env.LOCALAPPDATA,'MERYO-deployment','backups');
const status=JSON.parse(await fs.readFile(path.join(root,'hosted-backup-status.json'),'utf8'));
const archive=process.argv[2]||status.archive;
if(!path.resolve(archive).startsWith(path.resolve(root)+path.sep))throw Error('Archive must be in the protected deployment backup folder');
const work=await fs.mkdtemp(path.join(root,'restore-check-'));
const key=cloud?Buffer.from(process.env.MERYO_BACKUP_KEY,'base64'):await fs.readFile(path.join(process.env.LOCALAPPDATA,'MERYO-backups','recovery','backup.key'));
const target=`meryo_restore_hosted_${Date.now()}`;
const config=cloud?{host:'/var/run/postgresql',port:55440,user:process.env.USER,database:'postgres'}:{host:'127.0.0.1',port:55440,user:'meryo_test_admin',database:'postgres'};
const admin=new pg.Client(config);await admin.connect();
const bin=cloud?'/usr/lib/postgresql/17/bin':'C:/Program Files/PostgreSQL/17/bin';
const executable=name=>path.join(bin,name+(process.platform==='win32'?'.exe':''));
const quote=value=>'"'+value.replaceAll('"','""')+'"';
const hash=async file=>{const sum=createHash('sha256');for await(const data of createReadStream(file))sum.update(data);return sum.digest('hex');};
const run=(exe,args)=>{const result=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,timeout:120000});if(result.status!==0){fs.writeFile(path.join(root,'restore-failure.txt'),result.stderr||'restore command failed').catch(()=>{});throw Error('Isolated restore failed; details kept private');}return result.stdout;};
try{
 const identity=(await admin.query('select host(inet_server_addr()) host,inet_server_port() port')).rows[0];
 if(cloud?identity.host!==null||identity.port!==null:identity.host!=='127.0.0.1'||identity.port!==55440)throw Error('Only an isolated local cluster is allowed');
 const tar=path.join(work,'archive.tar');await decryptBackup(archive,tar,key);
 const tarCommand=process.platform==='win32'?'tar.exe':'tar';
 const entries=run(tarCommand,['-tf',tar]).split(/\r?\n/).filter(Boolean);
 if(entries.some(e=>path.isAbsolute(e)||e.includes(':')||e.split(/[\\/]/).includes('..')))throw Error('Unsafe archive entry');
 run(tarCommand,['-xf',tar,'-C',work]);
 const manifest=JSON.parse(await fs.readFile(path.join(work,'manifest.json'),'utf8'));
 for(const [name,sha] of Object.entries(manifest.files)){if(!path.resolve(work,name).startsWith(path.resolve(work)+path.sep)||await hash(path.join(work,name))!==sha)throw Error('Restored file integrity mismatch');}
 // Preserve existing cluster roles; add only missing NOLOGIN names needed by archived ACLs.
 const roles=await fs.readFile(path.join(work,'roles.sql'),'utf8');
 for(const match of roles.matchAll(/^CREATE ROLE ("(?:[^"]|"")+"|[^;\s]+);$/gm)){
  const name=match[1].startsWith('"')?match[1].slice(1,-1).replaceAll('""','"'):match[1];
  if(!(await admin.query('select 1 from pg_roles where rolname=$1',[name])).rowCount)await admin.query(`create role ${quote(name)} nologin`);
 }
 await admin.query(`create database ${quote(target)}`);
 const restored=new pg.Client({...config,database:target});await restored.connect();
 try{
  await restored.query('create schema extensions');
  await restored.query('create schema auth; create schema storage; create schema meryo_private; create schema supabase_migrations');
  // Namespace-free publication entries are excluded by pg_restore --schema.
  // This only restores the relation metadata; no Realtime service is started.
  await restored.query('create publication supabase_realtime');
  for(const ext of ['btree_gist','pgcrypto','uuid-ossp'])await restored.query(`create extension ${quote(ext)} with schema extensions`);
  run(executable('pg_restore'),[`--host=${config.host}`,`--port=${config.port}`,`--username=${config.user}`,`--dbname=${target}`,'--no-owner','--exit-on-error','--schema=public','--schema=auth','--schema=storage','--schema=meryo_private','--schema=supabase_migrations',path.join(work,'database.dump')]);
  for(const [table,count] of Object.entries(manifest.counts)){const name=table.split('.').map(quote).join('.');if((await restored.query(`select count(*)::text n from ${name}`)).rows[0].n!==count)throw Error('Restored table count mismatch');}
  const result={verifiedAt:new Date().toISOString(),archive:path.basename(archive),database:target,projectRef:manifest.projectRef,tableCountsVerified:Object.keys(manifest.counts).length,fileHashesVerified:Object.keys(manifest.files).length,storageObjects:manifest.objects.length,productionModified:false,scope:'public/Auth/Storage SQL and object file integrity; managed Supabase services, platform extensions, API settings and outbound deliveries not emulated'};
  await fs.writeFile(path.join(root,'hosted-restore-status.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
 }finally{await restored.end();}
}finally{key.fill(0);await admin.end();await fs.rm(work,{recursive:true,force:true});}
