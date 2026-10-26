import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import pg from 'pg';
import net from 'node:net';
import {encryptBackup,decryptBackup} from '../server/backup-crypto.mjs';
import {uploadAndVerifyDrive} from '../server/drive-backup.mjs';
import {realConfig,nativeRoot} from './setup-real-auth.mjs';
const root=path.join(process.env.LOCALAPPDATA,'MERYO-backups'),repo=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const bin='C:/Program Files/PostgreSQL/17/bin',cluster=path.join(process.env.LOCALAPPDATA,'MERYO-tests','pg17-20261024');
const tables=['auth.users','public.profiles','public.barberias','public.servicios','public.reservas','public.pagos'];
const run=(exe,args)=>{const r=spawnSync(exe,args,{encoding:'utf8',windowsHide:true});if(r.status!==0)throw Error(`${path.basename(exe)} failed; backup/restore was not verified`);return r.stdout;};
const hash=async file=>{const sum=createHash('sha256');for await(const chunk of createReadStream(file))sum.update(chunk);return sum.digest('hex');};
await fs.mkdir(root,{recursive:true});
const configFile=path.join(root,'config.json');let config;
try{config=JSON.parse(await fs.readFile(configFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;config={retentionDays:30,independentDestination:null,keyFile:path.join(root,'recovery','backup.key')};await fs.mkdir(path.dirname(config.keyFile),{recursive:true});await fs.writeFile(config.keyFile,randomBytes(32),{flag:'wx',mode:0o600});await fs.writeFile(configFile,JSON.stringify(config,null,2),{flag:'wx'});}
if(config.retentionDays!==30)throw Error('Retention must be the approved 30 days');
const key=await fs.readFile(config.keyFile),work=await fs.mkdtemp(path.join(root,'work-'));
let started=false,db;
try{
 const listening=await new Promise(resolve=>{const socket=net.connect({host:'127.0.0.1',port:55440});socket.setTimeout(1500);let done=false;const end=value=>{if(done)return;done=true;socket.destroy();resolve(value);};socket.once('connect',()=>end(true));socket.once('error',()=>end(false));socket.once('timeout',()=>end(false));});
 if(!listening){await fs.access(path.join(cluster,'PG_VERSION'));run(path.join(bin,'pg_ctl.exe'),['-D',cluster,'-l',path.join(root,'pg-backup-start.log'),'-o','-h 127.0.0.1 -p 55440 -c shared_buffers=32MB -c max_connections=20','-w','start']);started=true;}
 db=new pg.Client(realConfig);await db.connect();
 if(process.argv[2]==='restore-test'){
  const archive=process.argv[3];if(!archive||!path.resolve(archive).startsWith(path.resolve(root)+path.sep))throw Error('Only this local backup repository can be restored');
  const tar=path.join(work,'restore.tar');await decryptBackup(archive,tar,key);
  const entries=run('tar.exe',['-tf',tar]).split(/\r?\n/).filter(Boolean);
  if(entries.some(e=>e.startsWith('/')||e.includes('..')||e.includes(':')))throw Error('Unsafe archive entry');
  run('tar.exe',['-xf',tar,'-C',work]);
  const target=`meryo_restore_${Date.now()}`;
  await db.query(`create database "${target}"`);
  run(path.join(bin,'pg_restore.exe'),['--host=127.0.0.1','--port=55440','--username=meryo_test_admin',`--dbname=${target}`,'--no-owner','--exit-on-error',path.join(work,'database.dump')]);
  const restored=new pg.Client({...realConfig,database:target});await restored.connect();
  try{const manifest=JSON.parse(await fs.readFile(path.join(work,'manifest.json'),'utf8'));for(const [table,count] of Object.entries(manifest.counts)){const n=(await restored.query(`select count(*)::int n from ${table}`)).rows[0].n;if(n!==count)throw Error('Restored row count mismatch');}
   for(const [file,sha] of Object.entries(manifest.files)){if(await hash(path.join(work,file))!==sha)throw Error('Restored file hash mismatch');}
   await fs.writeFile(path.join(root,'restore-status.json'),JSON.stringify({verifiedAt:new Date().toISOString(),archive:path.basename(archive),database:target,databaseCountsVerified:true,fileHashesVerified:true,production:false}));
   console.log(`Restauración local verificada en ${target}; base principal intacta.`);
  }finally{await restored.end();}
 }else{
  await db.query('begin isolation level repeatable read read only');
  const snapshot=(await db.query('select pg_export_snapshot() snapshot')).rows[0].snapshot;
  const counts={};for(const table of tables)counts[table]=(await db.query(`select count(*)::int n from ${table}`)).rows[0].n;
  run(path.join(bin,'pg_dump.exe'),['--host=127.0.0.1','--port=55440','--username=meryo_test_admin','--dbname=meryo_auth_local','--format=custom',`--snapshot=${snapshot}`,`--file=${path.join(work,'database.dump')}`]);
  await db.query('commit');
  const files={};
  const selected=['src','public','db','scripts','server','docs','package.json','package-lock.json','vite.config.js','index.html','AGENTS.md'];
  for(const name of selected){const dest=path.join(work,'files',name);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.cp(path.join(repo,name),dest,{recursive:true,filter:async source=>!(await fs.lstat(source)).isSymbolicLink()&&!path.basename(source).startsWith('.env')});}
  await fs.mkdir(path.join(work,'private-config'),{recursive:true});
  for(const name of ['local-secrets.json','connections.json'])try{await fs.copyFile(path.join(nativeRoot,name),path.join(work,'private-config',name));}catch(e){if(e.code!=='ENOENT')throw e;}
  async function collect(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await collect(file);else files[path.relative(work,file)]=await hash(file);}}
  await collect(path.join(work,'files'));await collect(path.join(work,'private-config'));
  await fs.writeFile(path.join(work,'manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),database:'meryo_auth_local',counts,files,scope:'local-native-only; not Supabase Storage objects'}));
  const tar=path.join(work,'backup.tar');run('tar.exe',['-cf',tar,'-C',work,'database.dump','manifest.json','files','private-config']);
  const encrypted=path.join(root,`${new Date().toISOString().replaceAll(':','-')}.meryo.enc`);await encryptBackup(tar,encrypted,key);
  // Verify authenticated decryption before reporting a successful local snapshot.
  const verify=path.join(work,'verify.tar');await decryptBackup(encrypted,verify,key);if(await hash(tar)!==await hash(verify))throw Error('Encrypted backup verification failed');
  let independent=false;const retentionDirs=[root];
  if(config.independentDestination?.kind==='google-drive'){
   const remote=await uploadAndVerifyDrive(root,encrypted);
   await fs.rm(remote.downloaded,{force:true});
   await fs.writeFile(path.join(root,'drive-status.json'),JSON.stringify({...remote,downloadRetained:false}));
   independent=true;
  }else if(config.independentDestination){
   const target=config.independentDestination;
   if(typeof target!=='object'||!['external-disk','nas'].includes(target.kind)||target.confirmedIndependentDevice!==true)throw Error('Choose and confirm the independent device first; cloud targets need remote verification');
   const dest=path.resolve(target.path);
   if(path.parse(dest).root===path.parse(root).root&&!dest.startsWith('\\\\'))throw Error('Independent destination must be a different mounted device or NAS; cloud sync requires separate remote verification');
   if(/^\\\\(localhost|127\.0\.0\.1)\\/i.test(dest))throw Error('Loopback share is not independent');
   await fs.mkdir(dest,{recursive:true});const copy=path.join(dest,path.basename(encrypted));await fs.copyFile(encrypted,copy);if(await hash(copy)!==await hash(encrypted))throw Error('Independent copy hash mismatch');independent=true;retentionDirs.push(dest);
  }
  for(const directory of retentionDirs)for(const file of await fs.readdir(directory))if(/^\d{4}-.*\.meryo\.enc$/.test(file)&&(Date.now()-(await fs.stat(path.join(directory,file))).mtimeMs)>30*86400000)await fs.unlink(path.join(directory,file));
  await fs.writeFile(path.join(root,'backup-status.json'),JSON.stringify({verifiedAt:new Date().toISOString(),archive:path.basename(encrypted),encrypted:true,retentionDays:30,independentCopyVerified:independent,production:false}));
  console.log('Respaldo LOCAL cifrado y descifrado verificado. Copia independiente: '+(independent?'verificada':'PENDIENTE de destino.'));console.log('Archivo: '+encrypted);
 }
}catch(error){await fs.writeFile(path.join(root,'last-failure.json'),JSON.stringify({at:new Date().toISOString(),stage:process.argv[2]||'backup',error:error.message}));throw error;}
finally{
 if(db)await db.end();if(started)run(path.join(bin,'pg_ctl.exe'),['-D',cluster,'-m','fast','-w','stop']);
 const resolved=path.resolve(work);if(resolved.startsWith(path.resolve(root)+path.sep)&&path.basename(resolved).startsWith('work-'))await fs.rm(resolved,{recursive:true,force:true});
}
