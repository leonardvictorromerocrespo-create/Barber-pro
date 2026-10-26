// Separate OAuth consent from MERYO sign-in. No secrets or callback codes are logged.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {OAuth2Client} from 'google-auth-library';
import {DRIVE_SCOPE} from '../server/drive-backup.mjs';
const root=path.join(process.env.LOCALAPPDATA,'MERYO-backups');
const config=JSON.parse(await fs.readFile(path.join(root,'drive-client.json'),'utf8'));
const c=config.installed;if(!c?.client_id||!c.client_secret)throw Error('Dedicated desktop OAuth client must be saved privately first');
const state=randomBytes(32).toString('hex');let pending=false;
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname!=='/oauth/callback'){res.writeHead(404).end();return;}
 const returned=url.searchParams.get('state')||'';
 if(pending||returned.length!==state.length||!timingSafeEqual(Buffer.from(returned),Buffer.from(state))){res.writeHead(400).end('Invalid authorization state');return;}
 pending=true;
 try{
  if(url.searchParams.has('error')||!url.searchParams.get('code'))throw Error('Consent not granted');
  const {tokens}=await auth.getToken({code:url.searchParams.get('code'),codeVerifier:pkce.codeVerifier});
  const scopes=(tokens.scope||'').split(' ');if(!tokens.refresh_token||!scopes.includes(DRIVE_SCOPE)||scopes.some(s=>s!==DRIVE_SCOPE))throw Error('Unexpected or incomplete Drive permissions');
  await fs.writeFile(path.join(root,'drive-connection.json'),JSON.stringify({clientId:c.client_id,clientSecret:c.client_secret,tokens,scope:DRIVE_SCOPE}),{mode:0o600});
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}).end('<h1>Conexión Drive autorizada</h1><p>El respaldo aún requiere verificar subida, descarga y restauración. Puedes volver a MERYO.</p><script>history.replaceState(null,"","/")</script>');
  console.log('Drive consent saved privately. Remote backup is NOT verified yet.');
 }catch{res.writeHead(400).end('No se guardó la conexión. Vuelve a autorizar desde MERYO.');console.error('Drive consent failed; no credentials logged.');}
 finally{server.close();clearTimeout(timer);}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const redirect=`http://127.0.0.1:${server.address().port}/oauth/callback`;
const auth=new OAuth2Client(c.client_id,c.client_secret,redirect),pkce=await auth.generateCodeVerifierAsync();
const url=auth.generateAuthUrl({access_type:'offline',prompt:'consent',scope:[DRIVE_SCOPE],state,code_challenge:pkce.codeChallenge,code_challenge_method:'S256'});
await fs.writeFile(path.join(root,'drive-consent-url.txt'),url,{mode:0o600});
console.log('Consent URL saved privately in MERYO-backups/drive-consent-url.txt. Waiting on loopback only.');
const timer=setTimeout(()=>{server.close();console.error('Drive consent expired; restart the connector.');},15*60*1000);
