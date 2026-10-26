import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {expiredArchives,DRIVE_SCOPE,uploadAndVerifyDrive} from '../server/drive-backup.mjs';
test('Drive retention touches only owned encrypted archives in the chosen folder older than 30 days',()=>{
 const now=Date.parse('2026-10-26T12:00:00Z');
 const old={id:'old',name:'2026-09-01T00-00-00Z.meryo.enc',parents:['private'],createdTime:'2026-09-01T00:00:00Z',appProperties:{meryoBackup:'v1'}};
 const files=[old,{...old,id:'another-folder',parents:['other']},{...old,id:'unowned',appProperties:{}},{...old,id:'key',name:'backup.key'},{...old,id:'new',createdTime:'2026-10-26T00:00:00Z'},{...old,id:'invalid',createdTime:'invalid'}];
 assert.deepEqual(expiredArchives(files,'private',now).map(f=>f.id),['old']);
 assert.equal(DRIVE_SCOPE,'https://www.googleapis.com/auth/drive.file');
});
test('transport unit check: downloaded bytes must match before remote verification or retention',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'meryo-drive-unit-'));
 try{
  const file=path.join(root,'2026-10-26T12-00-00Z.meryo.enc');await fs.writeFile(file,'unit-fixture-not-a-real-backup');
  let good=false,retentionCalls=0;
  const connect=async()=>({saved:{folderId:'private'},save:async()=>{},request:async(url,options={})=>{
   if(url.includes('/about?'))return Response.json({storageQuota:{limit:'15000000000',usage:'1000'}});
   if(url.includes('uploadType=resumable'))return new Response('',{headers:{location:'https://www.googleapis.com/upload/unit'}});
   if(options.method==='PUT')return Response.json({id:'uploaded'});
   if(url.includes('alt=media'))return new Response(good?'unit-fixture-not-a-real-backup':'corrupted');
   if(url.includes('files?')){retentionCalls++;return Response.json({files:[]});}
   return Response.json({id:'private',mimeType:'application/vnd.google-apps.folder',shared:false,trashed:false});
  }});
  await assert.rejects(uploadAndVerifyDrive(root,file,connect),/hash mismatch/);
  assert.equal(retentionCalls,0);assert.deepEqual(await fs.readdir(root),[path.basename(file)]);
  good=true;const result=await uploadAndVerifyDrive(root,file,connect);
  assert.equal(result.fileId,'uploaded');assert.equal(result.retentionDays,30);assert.equal(retentionCalls,1);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
