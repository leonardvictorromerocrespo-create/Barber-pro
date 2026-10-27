import crypto from 'node:crypto';
// Generated synthetic test factors only; never the owner's personal Authenticator.
export function totp(secret){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of secret.replaceAll('=','').toUpperCase())bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');
 const key=Buffer.from(bits.match(/.{8}/g).map(b=>parseInt(b,2))),counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
 const value=crypto.createHmac('sha1',key).update(counter).digest(),offset=value[19]&15;
 return String((value.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
