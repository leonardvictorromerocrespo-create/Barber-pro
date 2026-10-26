// Portable, dependency-free recovery-key envelope. Never logs keys or passwords.
import {createCipheriv,createDecipheriv,randomBytes,pbkdf2Sync,timingSafeEqual} from 'node:crypto';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const iterations=600000;
export function sealKey(key,password){
 if(key.length!==32||typeof password!=='string'||password.length<14||password.length>1024)throw Error('A 32-byte backup key and a password of 14–1024 characters are required');
 const salt=randomBytes(16),iv=randomBytes(12),derived=pbkdf2Sync(password,salt,iterations,32,'sha256');
 try{const cipher=createCipheriv('aes-256-gcm',derived,iv);cipher.setAAD(Buffer.from('MERYO-RECOVERY-1'));
  const encrypted=Buffer.concat([cipher.update(key),cipher.final()]);
  return {format:'MERYO-RECOVERY-1',kdf:'PBKDF2-SHA256',iterations,salt:salt.toString('base64'),iv:iv.toString('base64'),ciphertext:encrypted.toString('base64'),tag:cipher.getAuthTag().toString('base64')};
 }finally{derived.fill(0);}
}
export function openKey(packet,password){
 if(packet.format!=='MERYO-RECOVERY-1'||packet.kdf!=='PBKDF2-SHA256'||packet.iterations!==iterations||typeof password!=='string'||password.length>1024)throw Error('Unsupported recovery envelope');
 const salt=Buffer.from(packet.salt,'base64'),iv=Buffer.from(packet.iv,'base64'),encrypted=Buffer.from(packet.ciphertext,'base64'),tag=Buffer.from(packet.tag,'base64');
 if(salt.length!==16||iv.length!==12||encrypted.length!==32||tag.length!==16)throw Error('Invalid recovery envelope');
 const derived=pbkdf2Sync(password,salt,iterations,32,'sha256');
 try{const decipher=createDecipheriv('aes-256-gcm',derived,iv);decipher.setAAD(Buffer.from('MERYO-RECOVERY-1'));decipher.setAuthTag(tag);return Buffer.concat([decipher.update(encrypted),decipher.final()]);}
 finally{derived.fill(0);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let input='',key,recovered;
 try{
  for await(const chunk of process.stdin){input+=chunk;if(input.length>10000)throw Error('Invalid private input');}
  const {password}=JSON.parse(input);input='';const [mode,source,destination]=process.argv.slice(2);
  if(mode==='seal'){
   key=await fs.readFile(source);const packet=sealKey(key,password);
   await fs.writeFile(destination,JSON.stringify(packet,null,2),{flag:'wx',mode:0o600});
   recovered=openKey(JSON.parse(await fs.readFile(destination,'utf8')),password);
   if(recovered.length!==key.length||!timingSafeEqual(recovered,key))throw Error('Recovery verification failed');
  }else if(mode==='unlock'){
   recovered=openKey(JSON.parse(await fs.readFile(source,'utf8')),password);
   await fs.writeFile(destination,recovered,{flag:'wx',mode:0o600});
  }else throw Error('Choose seal or unlock');
  console.log(JSON.stringify({verified:true,mode,at:new Date().toISOString()}));
 }catch{console.error('No se pudo completar: comprueba la contraseña, el archivo y que el destino no exista. No se mostraron claves.');process.exitCode=1;}
 finally{key?.fill(0);recovered?.fill(0);}
}
