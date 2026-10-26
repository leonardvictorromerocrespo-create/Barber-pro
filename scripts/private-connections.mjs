import fs from 'node:fs/promises';
import path from 'node:path';
import webpush from 'web-push';
import {nativeRoot} from './setup-real-auth.mjs';
export const connectionsFile=path.join(nativeRoot,'connections.json');
export async function connections(){
 try{return JSON.parse(await fs.readFile(connectionsFile,'utf8'));}
 catch(e){if(e.code!=='ENOENT')throw e;}
 const data={google:{clientId:'',clientSecret:''},push:{enabled:false,subject:'',...webpush.generateVAPIDKeys()}};
 await fs.writeFile(connectionsFile,JSON.stringify(data,null,2),{flag:'wx'});return data;
}
