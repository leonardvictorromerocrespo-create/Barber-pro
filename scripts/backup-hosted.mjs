import fs from 'node:fs/promises';
import path from 'node:path';
import {hostedBackup} from '../server/hosted-backup.mjs';
const root=path.join(process.env.LOCALAPPDATA,'MERYO-deployment');
const config=JSON.parse(await fs.readFile(path.join(root,'hosted-source.json'),'utf8'));
const storage=JSON.parse(await fs.readFile(path.join(root,'hosted-storage.json'),'utf8'));
const key=await fs.readFile(path.join(process.env.LOCALAPPDATA,'MERYO-backups','recovery','backup.key'));
const result=await hostedBackup({config,storage,key,root:path.join(root,'backups'),pgBin:'C:/Program Files/PostgreSQL/17/bin'});
console.log(JSON.stringify({encrypted:true,tables:result.tableCount,storageObjects:result.objectCount,bytes:result.bytes,restoreVerified:false}));
