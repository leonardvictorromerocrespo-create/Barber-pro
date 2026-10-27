// Export ONLY SQL definitions/system migration versions from the existing native test DB.
import fs from 'node:fs/promises';import path from 'node:path';import {spawnSync} from 'node:child_process';import pg from 'pg';import {createHash} from 'node:crypto';
const config={host:'127.0.0.1',port:55440,user:'meryo_test_admin',database:'meryo_auth_local'};
const dump=spawnSync('C:/Program Files/PostgreSQL/17/bin/pg_dump.exe',['--host=127.0.0.1','--port=55440','--username=meryo_test_admin','--dbname=meryo_auth_local','--schema-only','--no-owner','--schema=public','--schema=auth','--schema=storage','--schema=meryo_private'],{encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});
if(dump.status!==0)throw Error('Native schema export failed');let sql=dump.stdout.replace(/^\\.*$/gm,'');
if(/eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(sql)||/^COPY /m.test(sql))throw Error('Unexpected token or rows in schema export');
const db=new pg.Client(config);await db.connect();try{
 const roles=(await db.query("select rolname from pg_roles where rolname !~ '^pg_' and rolname<>'postgres' order by rolname")).rows.map(r=>r.rolname);
 const authVersions=(await db.query('select version from auth.schema_migrations order by version')).rows.map(r=>r.version);
 const restore=JSON.parse(await fs.readFile(path.join(process.env.LOCALAPPDATA,'MERYO-deployment/backups/hosted-restore-status.json'),'utf8'));
 if(!/^meryo_restore_hosted_\d+$/.test(restore.database))throw Error('Wrong metadata source');
 const copy=new pg.Client({...config,database:restore.database});await copy.connect();let storageVersions;
 try{storageVersions=(await copy.query('select id,name,hash from storage.migrations order by id')).rows;}finally{await copy.end();}
 await fs.mkdir('db/reference/storage-ci',{recursive:true});
 await fs.writeFile('db/reference/storage-ci/schema.sql',sql);
 await fs.writeFile('db/reference/storage-ci/system-metadata.json',JSON.stringify({roles,authVersions,storageVersions,sha256:createHash('sha256').update(sql).digest('hex'),scope:'Definitions and official migration identifiers/hashes only. No users, sessions, MFA factors, files, business rows or credentials.'},null,2));
 console.log(JSON.stringify({metadataOnly:true,bytes:Buffer.byteLength(sql),authMigrationVersions:authVersions.length}));
}finally{await db.end();}
