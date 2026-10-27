import fs from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import path from 'node:path';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';
import {createHash} from 'node:crypto';
import {OAuth2Client} from 'google-auth-library';

export const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
export async function sha256(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
export function expiredArchives(files,folderId,now=Date.now()){
 return files.filter(f=>f.parents?.includes(folderId)&&f.appProperties?.meryoBackup==='v1'&&/^\d{4}-.*\.meryo\.enc$/.test(f.name)&&Number.isFinite(Date.parse(f.createdTime))&&now-Date.parse(f.createdTime)>30*86400000);
}
export async function driveConnection(root){
 const file=path.join(root,'drive-connection.json'),saved=JSON.parse(await fs.readFile(file,'utf8'));
 if(saved.scope!==DRIVE_SCOPE||!saved.tokens?.refresh_token)throw Error('Drive backup consent with drive.file and offline access is required');
 const auth=new OAuth2Client(saved.clientId,saved.clientSecret);auth.setCredentials(saved.tokens);
 auth.on('tokens',tokens=>{saved.tokens={...saved.tokens,...tokens};fs.writeFile(file,JSON.stringify(saved),{mode:0o600}).catch(()=>{});});
 const request=async(url,options={})=>{
  const {token}=await auth.getAccessToken();const result=await fetch(url,{...options,headers:{...options.headers,Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(120000)});
  if(!result.ok)throw Error(`Drive backup request failed (${result.status}); remote copy not verified`);return result;
 };
 return {saved,request,save:()=>fs.writeFile(file,JSON.stringify(saved),{mode:0o600})};
}
export async function uploadAndVerifyDrive(root,archive,connect=driveConnection){
 if(!/^\d{4}-.*\.meryo\.enc$/.test(path.basename(archive)))throw Error('Only encrypted MERYO archives may be uploaded');
 const {saved,request,save}=await connect(root);
 const base='https://www.googleapis.com/drive/v3';
 const quota=await (await request(`${base}/about?fields=storageQuota`)).json();
 const size=(await fs.stat(archive)).size;
 if(size>250*1024*1024)throw Error('Archive exceeds the approved 250 MiB per-run safety cap; review free capacity before increasing it');
 const {limit,usage}=quota.storageQuota||{};
 if(!limit||!usage||BigInt(limit)-BigInt(usage)<BigInt(size))throw Error('Free Drive capacity could not be verified or is insufficient; no capacity purchased');
 if(!saved.folderId){const folder=await (await request(`${base}/files?fields=id`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'MERYO Backups',mimeType:'application/vnd.google-apps.folder',appProperties:{meryoBackup:'v1'}})})).json();saved.folderId=folder.id;await save();}
 const folder=await (await request(`${base}/files/${encodeURIComponent(saved.folderId)}?fields=id,mimeType,trashed,shared`)).json();
 if(folder.trashed||folder.shared||folder.mimeType!=='application/vnd.google-apps.folder')throw Error('Backup folder must be private and active');
 const meta={name:path.basename(archive),parents:[saved.folderId],appProperties:{meryoBackup:'v1'}};
 const start=await request('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name',{method:'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':'application/octet-stream','X-Upload-Content-Length':String(size)},body:JSON.stringify(meta)});
 const location=start.headers.get('location');if(!location||new URL(location).origin!=='https://www.googleapis.com')throw Error('Unexpected Drive upload destination');
 const uploaded=await (await request(location,{method:'PUT',duplex:'half',headers:{'Content-Type':'application/octet-stream','Content-Length':String(size)},body:createReadStream(archive)})).json();
 const downloaded=path.join(root,`download-${path.basename(archive)}`);
 try{
  const response=await request(`${base}/files/${encodeURIComponent(uploaded.id)}?alt=media`);
  await pipeline(Readable.fromWeb(response.body),createWriteStream(downloaded,{flags:'wx',mode:0o600}));
  if(await sha256(downloaded)!==await sha256(archive))throw Error('Drive download hash mismatch');
 }catch(error){await fs.rm(downloaded,{force:true});throw error;}
 // Retire only this application's own encrypted archives in this private folder.
 let pageToken;do{
  const query=new URLSearchParams({q:`'${saved.folderId}' in parents and trashed = false`,fields:'nextPageToken,files(id,name,createdTime,parents,appProperties)',pageSize:'1000',...(pageToken?{pageToken}:{})});
  const page=await (await request(`${base}/files?${query}`)).json();
  for(const old of expiredArchives(page.files||[],saved.folderId))await request(`${base}/files/${encodeURIComponent(old.id)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({trashed:true})});
  pageToken=page.nextPageToken;
 }while(pageToken);
 return {verifiedAt:new Date().toISOString(),fileId:uploaded.id,downloaded,sha256:await sha256(downloaded),freeBytesBeforeUpload:String(BigInt(limit)-BigInt(usage)),retentionDays:30,scope:'Encrypted archive transport only; coverage is determined by its verified manifest'};
}
