import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {encryptBackup,decryptBackup} from '../server/backup-crypto.mjs';
import {validatePushEndpoint} from '../server/web-push.mjs';
test('encrypted backup rejects tampering and wrong recovery key',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'meryo-backup-check-'));
 try{
  const input=path.join(root,'source'),sealed=path.join(root,'encrypted');const key=crypto.randomBytes(32);
  await fs.writeFile(input,'non-sensitive restoration fixture');await encryptBackup(input,sealed,key);
  await decryptBackup(sealed,path.join(root,'restored'),key);assert.equal(await fs.readFile(path.join(root,'restored'),'utf8'),'non-sensitive restoration fixture');
  await assert.rejects(decryptBackup(sealed,path.join(root,'wrong-key'),crypto.randomBytes(32)));
  const bytes=await fs.readFile(sealed);bytes[22]^=1;await fs.writeFile(sealed,bytes);await assert.rejects(decryptBackup(sealed,path.join(root,'tampered'),key));
 }finally{if(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(root).startsWith('meryo-backup-check-'))await fs.rm(root,{recursive:true,force:true});}
});
test('push endpoints cannot turn the sender into an internal URL requester',()=>{
 assert.match(validatePushEndpoint('https://fcm.googleapis.com/wp/abc'),/^https:/);
 for(const url of ['http://fcm.googleapis.com/a','https://127.0.0.1/a','https://fcm.googleapis.com.evil.invalid/a','https://u:p@fcm.googleapis.com/a','https://fcm.googleapis.com:4433/a'])assert.throws(()=>validatePushEndpoint(url));
});
test('worker deep link targets its booking, acknowledges reception only after notification succeeds',async()=>{
 const handlers={},notifications=[],acks=[],opened=[];
 const self={location:{origin:'https://meryo.example'},addEventListener:(type,fn)=>{handlers[type]=fn;},registration:{showNotification:async(title,options)=>{notifications.push({title,options});}},clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}};
 vm.runInNewContext(await fs.readFile(new URL('../public/meryo-push-sw.js',import.meta.url),'utf8'),{self,URL,fetch:async(url,opts)=>{acks.push({url,opts});}});
 let work;const id='10000000-0000-0000-0000-000000000001';
 handlers.push({data:{json:()=>({bookingId:id,body:'Tu barbero aceptó la cita. Tienes 10 minutos para pagar el adelanto y confirmarla.',receipt:{id:'receipt',token:'opaque'}})},waitUntil:p=>{work=p;}});await work;
 assert.equal(notifications[0].options.data.url,`/?cita=${id}#my-bookings`);assert.equal(acks.length,1);
 handlers.notificationclick({notification:{close(){},data:notifications[0].options.data},waitUntil:p=>{work=p;}});await work;assert.equal(opened[0],`https://meryo.example/?cita=${id}#my-bookings`);
});
