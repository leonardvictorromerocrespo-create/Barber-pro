import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'vite';
import {nativeRoot,prepareDatabase,preparePublic,secrets} from './setup-real-auth.mjs';
import pg from 'pg';
import {realConfig} from './setup-real-auth.mjs';
import {startReservationMaintenance} from '../server/reservation-maintenance.mjs';
import {connections} from './private-connections.mjs';
import {startPushWorker,acknowledgePush} from '../server/web-push.mjs';

const children=[];let vite,stopping=false,maintenance,pool,stopPush;
async function stop(){if(stopping)return;stopping=true;if(stopPush)stopPush();if(maintenance)await maintenance();if(pool)await pool.end();if(vite)await vite.close();for(const child of children)child.kill();}
async function healthy(url,child){
 for(let i=0;i<120;i++){
  if(child.exitCode!==null)throw Error('El servicio nativo salió antes de iniciar');
  try{const r=await fetch(url,{signal:AbortSignal.timeout(1000)});if(r.ok)return;}catch{}
  await new Promise(r=>setTimeout(r,300));
 }
 throw Error('El servicio nativo no respondió a tiempo');
}
function launch(binary,env,name){
 const log=fs.openSync(path.join(nativeRoot,`${name}.log`),'a');
 const child=spawn(path.join(nativeRoot,binary),[],{cwd:nativeRoot,env:{...process.env,PATH:`C:/Program Files/PostgreSQL/17/bin;${process.env.PATH}`, ...env},windowsHide:true,stdio:['ignore',log,log]});children.push(child);fs.closeSync(log);return child;
}
try{
 for(const binary of ['gotrue.exe','postgrest.exe'])if(!fs.existsSync(path.join(nativeRoot,binary)))throw Error('Faltan ejecutables nativos de Auth/PostgREST');
 await prepareDatabase();const s=await secrets(),config=await connections();
 const googleReady=Boolean(config.google?.clientId&&config.google?.clientSecret);
 const pushReady=Boolean(config.push?.enabled&&config.push?.publicKey&&config.push?.privateKey&&config.push?.subject);
 const authUrl=`postgres://meryo_auth_owner:${s.authPassword}@127.0.0.1:55440/meryo_auth_local?sslmode=disable`;
 const auth=launch('gotrue.exe',{
  GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:authUrl,DATABASE_URL:authUrl,DB_NAMESPACE:'auth',
  GOTRUE_API_HOST:'127.0.0.1',PORT:'55441',API_EXTERNAL_URL:'http://127.0.0.1:5178/__supabase/auth/v1',
  GOTRUE_SITE_URL:'http://127.0.0.1:5178',GOTRUE_URI_ALLOW_LIST:'http://127.0.0.1:5178/**',
  GOTRUE_EXTERNAL_GOOGLE_ENABLED:String(googleReady),GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID:config.google?.clientId||'',GOTRUE_EXTERNAL_GOOGLE_SECRET:config.google?.clientSecret||'',
  GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI:'http://127.0.0.1:5178/__supabase/auth/v1/callback',
  GOTRUE_JWT_SECRET:s.jwtSecret,GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_JWT_EXP:'3600',
  GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_EXTERNAL_PHONE_ENABLED:'false',GOTRUE_DISABLE_SIGNUP:'false',GOTRUE_MAILER_AUTOCONFIRM:'true',
  GOTRUE_PASSWORD_MIN_LENGTH:'8',GOTRUE_DB_MAX_POOL_SIZE:'4',GOTRUE_TRACING_ENABLED:'false',GOTRUE_METRICS_ENABLED:'false',
  GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED:'true',LOG_LEVEL:'warn',GOMAXPROCS:'2',GOMEMLIMIT:'128MiB',
 },'auth');
 await healthy('http://127.0.0.1:55441/health',auth);await preparePublic();
 const rest=launch('postgrest.exe',{
  PGRST_DB_URI:`postgres://meryo_rest_login:${s.restPassword}@127.0.0.1:55440/meryo_auth_local?sslmode=disable`,
  PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:s.jwtSecret,PGRST_JWT_AUD:'authenticated',
  PGRST_SERVER_HOST:'127.0.0.1',PGRST_SERVER_PORT:'55442',PGRST_DB_POOL:'4',PGRST_LOG_LEVEL:'error',GHCRTS:'-N2',
 },'postgrest');
 await healthy('http://127.0.0.1:55442/',rest);
 pool=new pg.Pool({...realConfig,max:1});
 maintenance=startReservationMaintenance(pool,{onError:message=>console.error(message)});
 await pool.query('update meryo_private.launch_settings set push_envio_habilitado=$1,push_public_key=$2 where id=1',[pushReady,pushReady?config.push.publicKey:null]);
 if(pushReady&&process.env.MERYO_DISABLE_PUSH_WORKER!=='1')stopPush=startPushWorker(pool,config.push);
 vite=await createServer({mode:'localauth',define:{'import.meta.env.VITE_MERYO_LOCAL_ANON_KEY':JSON.stringify(s.anonKey),'import.meta.env.VITE_MERYO_GOOGLE_ENABLED':googleReady},server:{host:'127.0.0.1',port:5178,strictPort:true,proxy:{
  '/__supabase/auth/v1':{target:'http://127.0.0.1:55441',rewrite:p=>p.replace(/^\/__supabase\/auth\/v1/,'')},
  '/__supabase/rest/v1':{target:'http://127.0.0.1:55442',rewrite:p=>p.replace(/^\/__supabase\/rest\/v1/,'')},
 }},plugins:[{name:'real-auth-local-only',configureServer(server){server.middlewares.use((req,res,next)=>{
  if(req.headers.host!=='127.0.0.1:5178'||(req.headers.origin&&req.headers.origin!=='http://127.0.0.1:5178')){res.statusCode=403;res.end('Solo localhost');return;}
  if((req.url==='/__meryo/push-ack'||req.url==='/api/push/ack')){
   if(req.method!=='POST'){res.statusCode=405;res.end();return;}
   let body='';req.on('data',chunk=>{body+=chunk;if(body.length>2048)req.destroy();});
   req.on('end',async()=>{try{const ok=await acknowledgePush(pool,JSON.parse(body));res.statusCode=ok?204:403;}catch{res.statusCode=400;}res.end();});return;
  }
  if(req.url.startsWith('/__local/')||req.url.startsWith('/tests/browser/')){res.statusCode=410;res.end('No hay actores ni banco simulado');return;}
  res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self' ws://127.0.0.1:5178; img-src 'self' data: https://tile.openstreetmap.org; media-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-src 'none'; worker-src 'self'");next();
 });},transformIndexHtml(html){return html.replace('<body>','<body><aside style="background:#fbbf24;color:#000;padding:10px;text-align:center;font:14px sans-serif">MERYO LOCAL · Supabase Auth y PostgREST reales · Correo autoconfirmado solo en pruebas · Sin pagos</aside>');}}]});
 await vite.listen();console.log('MERYO con Auth real: http://127.0.0.1:5178/ · PostgreSQL existente, base meryo_auth_local');
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{stop().then(()=>process.exit(0));});
 process.stdin.on('data',data=>{if(data.toString().trim()==='stop')stop().then(()=>process.exit(0));});
}catch(error){console.error(`No se inició Auth local: ${error.message}. Logs privados en native-auth; sin fallback a producción.`);await stop();process.exitCode=1;}
