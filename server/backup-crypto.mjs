import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
const MAGIC=Buffer.from('MERYOBK1');
export async function encryptBackup(input,output,key){
 if(key.length!==32)throw Error('AES-256 key required');const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 await fsp.writeFile(output,Buffer.concat([MAGIC,iv]),{flag:'wx',mode:0o600});
 await pipeline(fs.createReadStream(input),cipher,fs.createWriteStream(output,{flags:'a'}));
 await fsp.appendFile(output,cipher.getAuthTag());
}
export async function decryptBackup(input,output,key){
 const h=await fsp.open(input,'r');let iv,tag,size;
 try{size=(await h.stat()).size;const prefix=Buffer.alloc(20);await h.read(prefix,0,20,0);if(size<36||!prefix.subarray(0,8).equals(MAGIC))throw Error('Unknown backup format');iv=prefix.subarray(8);tag=Buffer.alloc(16);await h.read(tag,0,16,size-16);}finally{await h.close();}
 const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAuthTag(tag);
 await pipeline(fs.createReadStream(input,{start:20,end:size-17}),decipher,fs.createWriteStream(output,{flags:'wx',mode:0o600}));
}
