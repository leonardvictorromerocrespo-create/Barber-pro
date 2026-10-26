import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'vite';
import {nativeRoot,prepareDatabase,preparePublic,secrets} from './setup-real-auth.mjs';

const children=[];let vite,stopping=false;
async function stop(){if(stopping)return;stopping=true;if(vite)await vite.close();for(const child of children)child.kill();}
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
 await prepareDatabase();const s=await secrets();
 const authUrl=`postgres://meryo_auth_owner:${s.authPassword}@127.0.0.1:55440/meryo_auth_local?sslmode=disable`;
 const auth=launch('gotrue.exe',{
  GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:authUrl,DATABASE_URL:authUrl,DB_NAMESPACE:'auth',
  GOTRUE_API_HOST:'127.0.0.1',PORT:'55441',API_EXTERNAL_URL:'http://127.0.0.1:5178/__supabase/auth/v1',
  GOTRUE_SITE_URL:'http://127.0.0.1:5178',GOTRUE_URI_ALLOW_LIST:'http://127.0.0.1:5178/**',
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
 vite=await createServer({mode:'localauth',define:{'import.meta.env.VITE_MERYO_LOCAL_ANON_KEY':JSON.stringify(s.anonKey)},server:{host:'127.0.0.1',port:5178,strictPort:true,proxy:{
  '/__supabase/auth/v1':{target:'http://127.0.0.1:55441',rewrite:p=>p.replace(/^\/__supabase\/auth\/v1/,'')},
  '/__supabase/rest/v1':{target:'http://127.0.0.1:55442',rewrite:p=>p.replace(/^\/__supabase\/rest\/v1/,'')},
 }},plugins:[{name:'real-auth-local-only',configureServer(server){server.middlewares.use((req,res,next)=>{
  if(req.headers.host!=='127.0.0.1:5178'||(req.headers.origin&&req.headers.origin!=='http://127.0.0.1:5178')){res.statusCode=403;res.end('Solo localhost');return;}
  if(req.url.startsWith('/__local/')||req.url.startsWith('/tests/browser/')){res.statusCode=410;res.end('No hay actores ni banco simulado');return;}
  res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self' ws://127.0.0.1:5178; img-src 'self' data:; media-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-src 'none'; worker-src 'none'");next();
 });},transformIndexHtml(html){return html.replace('<body>','<body><aside style="background:#fbbf24;color:#000;padding:10px;text-align:center;font:14px sans-serif">MERYO LOCAL · Supabase Auth y PostgREST reales · Correo autoconfirmado solo en pruebas · Sin pagos</aside>');}}]});
 await vite.listen();console.log('MERYO con Auth real: http://127.0.0.1:5178/ · PostgreSQL existente, base meryo_auth_local');
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{stop().then(()=>process.exit(0));});
 process.stdin.on('data',data=>{if(data.toString().trim()==='stop')stop().then(()=>process.exit(0));});
}catch(error){console.error(`No se inició Auth local: ${error.message}. Logs privados en native-auth; sin fallback a producción.`);await stop();process.exitCode=1;}
