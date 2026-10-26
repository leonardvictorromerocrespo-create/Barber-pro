import { createServer } from 'vite';
import { createLocalPool,checkLocalTarget,seedLocal,asLocal } from '../server/local-db.mjs';
import { localApi } from '../server/local-api.mjs';

const pool=createLocalPool();
let vite,timer;
async function stop(){clearInterval(timer);if(vite)await vite.close();await pool.end();}
try{
  await checkLocalTarget(pool);await seedLocal(pool);
  vite=await createServer({mode:'localtest',server:{host:'127.0.0.1',port:5178,strictPort:true},plugins:[{
    name:'meryo-loopback-only',
    configureServer(server){
      server.middlewares.use((req,res,next)=>{
        if(req.url.startsWith('/tests/browser/')){res.statusCode=410;res.end('Banco separado retirado. Usa las pantallas MERYO en /');return;}
        res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self' ws://127.0.0.1:5178; img-src 'self' data:; media-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-src 'none'; worker-src 'none'");
        next();
      });
      server.middlewares.use(localApi(pool));
    },
    transformIndexHtml(html){return html.replace('<body>','<body><aside style="background:#fbbf24;color:#000;padding:10px;text-align:center;font:14px sans-serif">MERYO LOCAL · Falta Supabase Auth de pruebas · Pagos bloqueados</aside>');},
  }]});
  let expiring=false;
  timer=setInterval(async()=>{
    if(expiring)return;expiring=true;
    try{await asLocal(pool,'server','select public.expirar_reservas_vencidas()');}
    catch{console.error('No se pudo ejecutar la expiracion LOCAL');}
    finally{expiring=false;}
  },1000);
  await vite.listen();
  console.log('MERYO aislado: http://127.0.0.1:5178 · PostgreSQL local 55440/meryo_test');
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{stop().then(()=>process.exit(0));});
}catch{
  console.error('No se inicio MERYO local. Revisa el cluster exclusivo y las migraciones locales ya preparadas. No hay fallback remoto.');
  await stop();process.exitCode=1;
}
