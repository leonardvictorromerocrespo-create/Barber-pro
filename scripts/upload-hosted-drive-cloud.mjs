// Existing hosted backup -> independently downloaded Drive copy -> isolated restore.
import fs from 'node:fs/promises';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {DRIVE_SCOPE,uploadAndVerifyDrive} from '../server/drive-backup.mjs';
if(process.env.GITHUB_ACTIONS!=='true'||!process.env.RUNNER_TEMP)throw Error('Authorized ephemeral backup runner only');
const root=process.env.MERYO_BACKUP_ROOT;
if(path.resolve(root||'')!==path.join(process.env.RUNNER_TEMP,'meryo-hosted-backup'))throw Error('Unexpected backup root');
const connection=JSON.parse(process.env.MERYO_DRIVE_CONFIG||'null');
if(connection?.scope!==DRIVE_SCOPE||!connection.tokens?.refresh_token||!connection.clientId||!connection.clientSecret)throw Error('Missing existing authorized drive.file connection');
const status=JSON.parse(await fs.readFile(path.join(root,'hosted-backup-status.json'),'utf8'));
if(!status.encrypted||!status.archive.startsWith(root+path.sep))throw Error('Verified encrypted hosted archive required');
await fs.writeFile(path.join(root,'drive-connection.json'),JSON.stringify(connection),{mode:0o600});
const remote=await uploadAndVerifyDrive(root,status.archive);
const restored=spawnSync(process.execPath,['scripts/restore-hosted-check.mjs',remote.downloaded],{env:process.env,encoding:'utf8',timeout:180000});
if(restored.status!==0)throw Error('The independent Drive download could not be restored; external backup is NOT verified');
const proof={verifiedAt:new Date().toISOString(),external:'Google Drive',encrypted:true,downloadHashVerified:true,independentDownloadRestored:true,tables:status.tableCount,storageObjects:status.objectCount,bytes:status.bytes,retentionDays:30,pcRequired:false,freeSpaceChecked:true,paidCapacityEnabled:false,scope:'Hosted PostgreSQL including Auth and current Storage objects; no continuous recovery guarantee'};
await fs.writeFile(path.join(root,'drive-hosted-status.json'),JSON.stringify(proof,null,2));
await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
