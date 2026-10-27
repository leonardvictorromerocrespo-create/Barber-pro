import fs from 'node:fs/promises';
import path from 'node:path';
import {hostedBackup} from '../server/hosted-backup.mjs';
if(process.env.GITHUB_ACTIONS!=='true'||!process.env.RUNNER_TEMP)throw Error('Only the authorized GitHub-hosted runner may execute this entry point');
const root=path.join(process.env.RUNNER_TEMP,'meryo-hosted-backup');
const config=JSON.parse(process.env.MERYO_DB_CONFIG||'null'),storage=JSON.parse(process.env.MERYO_STORAGE_CONFIG||'null');
if(!config||!storage||!process.env.MERYO_BACKUP_KEY)throw Error('Missing private backup connections; no source modified');
const key=Buffer.from(process.env.MERYO_BACKUP_KEY,'base64');
const target=process.env.MERYO_DRIVE_CONFIG?'drive':'artifact';
try{
 const result=await hostedBackup({config,storage,key,root,pgBin:'/usr/lib/postgresql/17/bin',maxBytes:(target==='drive'?250:12)*1024*1024});
 await fs.appendFile(process.env.GITHUB_OUTPUT,`archive=${result.archive}\nroot=${root}\nexternal=${target}\n`);
 console.log(JSON.stringify({encrypted:true,tables:result.tableCount,storageObjects:result.objectCount,bytes:result.bytes,retentionDays:30,restoreVerified:false}));
}finally{key.fill(0);}
