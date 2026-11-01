// Real official services on a disposable standard Linux runner. No production secrets.
import fs from 'node:fs/promises';import {createWriteStream} from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {spawn,spawnSync} from 'node:child_process';import http from 'node:http';
import pg from 'pg';import webpush from 'web-push';import {createClient} from '@supabase/supabase-js';import assert from 'node:assert/strict';
import {createMeryoApi} from '../src/lib/meryo-api.js';import {uploadContent,CONTENT_BUCKET} from '../src/lib/shop-content.js';import {totp} from '../tests/helpers/totp.mjs';import {fechaLima,sumarDias} from '../src/lib/dates.js';
import {deliverBookingPush} from '../server/web-push.mjs';
if(process.env.GITHUB_ACTIONS!=='true'||process.platform!=='linux'||!process.env.RUNNER_TEMP)throw Error('Disposable GitHub Linux runner only');
const root=path.join(process.env.RUNNER_TEMP,'meryo-official'),dbName='meryo_ci_storage',user=process.env.USER,setupOnly=process.env.MERYO_CI_SETUP_ONLY==='true';
const jwtSecret=crypto.randomBytes(48).toString('hex'),password=crypto.randomBytes(24).toString('hex');
function jwt(role){const body=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({role,aud:'authenticated',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');return body+'.'+crypto.createHmac('sha256',jwtSecret).update(body).digest('base64url');}
const anon=jwt('anon'),service=jwt('service_role');for(const value of [jwtSecret,password,anon,service])console.log('::add-mask::'+value);
const db=new pg.Client({host:'/var/run/postgresql',port:55440,user,database:dbName});await db.connect();
const children=[],logs=[];let proxy;
const url=`postgresql://${encodeURIComponent(user)}:${password}@127.0.0.1:55440/${dbName}?sslmode=disable`;
function launch(binary,args,env,name,cwd=root){const output=path.join(process.env.RUNNER_TEMP,`meryo-${name}.log`);const stream=createWriteStream(output);logs.push(output);const child=spawn(binary,args,{cwd,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});child.stdout.pipe(stream);child.stderr.pipe(stream);children.push(child);return child;}
async function healthy(url,child){for(let i=0;i<180;i++){if(child.exitCode!==null)throw Error('Official service exited: '+path.basename(child.spawnfile));try{const r=await fetch(url,{signal:AbortSignal.timeout(1000)});if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,300));}throw Error('Official service did not become healthy');}
const make=()=>createClient('http://127.0.0.1:5178/__supabase',anon,{auth:{persistSession:false,autoRefreshToken:false}});
const clients=[];let proof,phase='schema bootstrap';
try{
 const schema=await fs.readFile('db/reference/storage-ci/schema.sql','utf8'),metadata=JSON.parse(await fs.readFile('db/reference/storage-ci/system-metadata.json','utf8'));
 if(crypto.createHash('sha256').update(schema).digest('hex')!==metadata.sha256)throw Error('Schema reference changed');
 for(const role of metadata.roles)if(!(await db.query('select 1 from pg_roles where rolname=$1',[role])).rowCount)await db.query('create role "'+role.replaceAll('"','""')+'" nologin');
 const alter=(await db.query('select format(\'alter role %I password %L\',$1::text,$2::text) sql',[user,password])).rows[0].sql;await db.query(alter);
 await db.query('alter role service_role bypassrls');
 if(setupOnly){
 const quote=value=>'"'+value.replaceAll('"','""')+'"';
 for(const ext of metadata.extensionSchemas){await db.query(`create schema if not exists ${quote(ext.schema)}`);await db.query(`create extension if not exists ${quote(ext.name)} with schema ${quote(ext.schema)}`);}
 await db.query('create extension if not exists pg_cron');
 await db.query(schema.replace('CREATE SCHEMA public;','CREATE SCHEMA IF NOT EXISTS public;'));
 // The recovered native policy fixture contains client ACLs, but not hosted
 // platform service-role grants. Mirror those for the trusted Storage service
 // only; authenticated/anon remain subject to the unchanged object RLS.
 await db.query('grant usage on schema storage to service_role;grant all on all tables in schema storage to service_role;grant usage,select on all sequences in schema storage to service_role');
 assert.equal((await db.query("select has_table_privilege('authenticated','storage.buckets','insert') allowed")).rows[0].allowed,false);
 assert.equal((await db.query("select has_table_privilege('authenticated','storage.objects','delete') allowed")).rows[0].allowed,false);
 for(const v of metadata.authVersions)await db.query('insert into auth.schema_migrations(version) values($1)',[v]);
 for(const m of metadata.storageVersions)await db.query('insert into storage.migrations(id,name,hash) values($1,$2,$3)',[m.id,m.name,m.hash]);
 await db.query("insert into public.configuracion(clave,valor) values('minutos_anticipacion_minima','30'),('paso_minutos','30'),('max_reservas_pendientes','2')");
 await db.query("insert into meryo_private.launch_settings(id,reservas_habilitadas,plazo_pago_segundos,entorno,modelo_comercial) values(1,true,600,'staging','mensualidad');insert into meryo_private.shop_content_settings values(1,true)");
 await db.query(await fs.readFile('db/incremental/021_product_pickup_store.sql','utf8'));
 const clean=(await db.query('select (select count(*) from auth.users)::int users,(select count(*) from public.barberias)::int shops')).rows[0];assert.deepEqual(clean,{users:0,shops:0});
 console.log('Disposable isolated schema and store migration prepared; no services started');
 }else{
 const ready=(await db.query("select to_regclass('public.meryo_products') is not null as products,to_regclass('public.meryo_pickup_orders') is not null as orders,(select count(*) from auth.users)::int users,(select count(*) from public.barberias)::int shops")).rows[0];
 assert.deepEqual(ready,{products:true,orders:true,users:0,shops:0},'The second isolated runner phase requires the clean prepared schema');
 }
 if(!setupOnly){
 // Match the existing native Auth role's search_path: Pop's migration ledger is
 // unqualified even though the actual Auth table definitions use auth.*.
 const authUrl=url+'&options='+encodeURIComponent('-c search_path=auth,public');
 const auth=launch(path.join(root,'gotrue'),[],{GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:authUrl,DATABASE_URL:authUrl,GOTRUE_DB_NAMESPACE:'auth',DB_NAMESPACE:'auth',GOTRUE_API_HOST:'127.0.0.1',PORT:'55441',API_EXTERNAL_URL:'http://127.0.0.1:5178/__supabase/auth/v1',GOTRUE_SITE_URL:'http://127.0.0.1:5178',GOTRUE_JWT_SECRET:jwtSecret,GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_MAILER_AUTOCONFIRM:'true',GOTRUE_DISABLE_SIGNUP:'false',GOTRUE_DB_MAX_POOL_SIZE:'3',LOG_LEVEL:'warn',GOMAXPROCS:'2',GOMEMLIMIT:'192MiB'},'auth');
 await healthy('http://127.0.0.1:55441/health',auth);
 const rest=launch(path.join(root,'postgrest'),[],{PGRST_DB_URI:url,PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:jwtSecret,PGRST_JWT_AUD:'authenticated',PGRST_SERVER_HOST:'127.0.0.1',PGRST_SERVER_PORT:'55442',PGRST_DB_POOL:'3',PGRST_LOG_LEVEL:'error'},'rest');
 await healthy('http://127.0.0.1:55442/',rest);
 const objects=path.join(process.env.RUNNER_TEMP,'meryo-synthetic-objects');await fs.mkdir(objects);
 const storage=launch(process.execPath,['--max-old-space-size=384','dist/start/server.js'],{NODE_ENV:'production',DATABASE_URL:url,DATABASE_POOL_URL:url,DATABASE_SEARCH_PATH:'storage,public,extensions',DATABASE_MAX_CONNECTIONS:'4',AUTH_JWT_SECRET:jwtSecret,AUTH_JWT_ALGORITHM:'HS256',ANON_KEY:anon,SERVICE_KEY:service,MULTI_TENANT:'false',PROJECT_REF:'meryo-isolated-ci',TENANT_ID:'meryo-isolated-ci',STORAGE_BACKEND:'file',STORAGE_FILE_BACKEND_PATH:objects,FILE_STORAGE_BACKEND_PATH:objects,PG_QUEUE_ENABLE:'false',S3_PROTOCOL_ENABLED:'false',IMAGE_TRANSFORMATION_ENABLED:'false',STORAGE_VERSIONING_ENABLED:'false',SERVER_HOST:'127.0.0.1',SERVER_PORT:'55443',SERVER_ADMIN_PORT:'55444',FILE_SIZE_LIMIT:'20971520',LOG_LEVEL:'warn'},'storage',path.join(root,'storage'));
 await healthy('http://127.0.0.1:55443/status',storage);
 proxy=http.createServer((req,res)=>{const routes=[['/__supabase/auth/v1',55441],['/__supabase/rest/v1',55442],['/__supabase/storage/v1',55443]],route=routes.find(([prefix])=>req.url.startsWith(prefix));if(!route){res.writeHead(404);res.end();return;}const upstream=http.request({hostname:'127.0.0.1',port:route[1],path:req.url.slice(route[0].length)||'/',method:req.method,headers:{...req.headers,host:'127.0.0.1:'+route[1]}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);});await new Promise(resolve=>proxy.listen(5178,'127.0.0.1',resolve));
 phase='private bucket provision';
 const serviceClient=createClient('http://127.0.0.1:5178/__supabase',service,{auth:{persistSession:false,autoRefreshToken:false}});
 assert.ifError((await serviceClient.storage.createBucket(CONTENT_BUCKET,{public:false,fileSizeLimit:20971520,allowedMimeTypes:['image/jpeg','image/png','image/webp','video/mp4','video/webm']})).error);
 const owner=make(),admin=make(),stranger=make(),anonymous=make();clients.push(owner,admin,stranger);
 const signup=async(c,label)=>{const r=await c.auth.signUp({email:label+'.'+crypto.randomUUID()+'@example.com',password:crypto.randomBytes(24).toString('base64url'),options:{data:{full_name:'Cuenta sintética '+label}}});assert.ifError(r.error);assert.ok(r.data.session);return r.data.user.id;};
 phase='genuine Auth accounts and MFA';
 const ownerId=await signup(owner,'owner'),adminId=await signup(admin,'admin'),strangerId=await signup(stranger,'stranger'),buyerTwo=make();clients.push(buyerTwo);const buyerTwoId=await signup(buyerTwo,'buyer-two');
 await db.query("update public.profiles set rol='admin' where id=$1",[adminId]);assert.ok((await admin.rpc('meryo_admin_barberias')).error,'AAL1 denied');
 const factor=await admin.auth.mfa.enroll({factorType:'totp',issuer:'MERYO CI synthetic'});assert.ifError(factor.error);assert.ifError((await admin.auth.mfa.challengeAndVerify({factorId:factor.data.id,code:totp(factor.data.totp.secret)})).error);
 const ownerApi=createMeryoApi(owner),adminApi=createMeryoApi(admin),publicApi=createMeryoApi(anonymous),buyerApi=createMeryoApi(stranger),buyerTwoApi=createMeryoApi(buyerTwo);
 phase='owner profile, services and private upload';
 const shop=await ownerApi.registerShop({nombre:'MERYO CI Storage',distrito:'Ate',direccion:'Dirección sintética CI',descripcion:'Contenido privado hasta aprobación',lat:-12.04,lng:-77.03,whatsapp:'',correo:''});
 assert.ifError((await owner.from('servicios').insert({barberia_id:shop,nombre:'Corte CI',precio:30,duracion_min:30,activo:true})).error);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8XcAAAAASUVORK5CYII=','base64');
 const cover=await uploadContent(owner,shop,new File([png],'cover.png',{type:'image/png'}),'portada','Portada CI');
 let assets=await ownerApi.shopAssets(shop);assert.equal(assets.length,1);const first=assets[0];assert.equal(first.id,cover);assert.deepEqual(Buffer.from(await(await fetch(first.url)).arrayBuffer()),png);
 phase='unapproved and cross-tenant object permissions';
 assert.deepEqual(await publicApi.catalog(),[]);
 assert.ok((await anonymous.storage.from(CONTENT_BUCKET).createSignedUrl(first.object_path,300)).error,'Unapproved object cannot be signed publicly');
 assert.ok((await stranger.storage.from(CONTENT_BUCKET).upload(`${shop}/${crypto.randomUUID()}.png`,png,{contentType:'image/png'})).error,'Cross-tenant upload denied');
 assert.ok((await stranger.rpc('meryo_retirar_archivo',{p_id:cover})).error,'Cross-tenant withdrawal denied');
 assert.ok((await owner.storage.from(CONTENT_BUCKET).upload(`${shop}/${crypto.randomUUID()}.html`,new Blob(['<script>bad</script>'],{type:'text/html'}),{contentType:'text/html'})).error,'Disallowed type denied');
 assert.ok((await owner.storage.from(CONTENT_BUCKET).upload(`${shop}/${crypto.randomUUID()}.png`,new Uint8Array(20971521),{contentType:'image/png'})).error,'Oversized payload denied');
 phase='replacement, real video and administrator approval';
 await uploadContent(owner,shop,new File([png],'replacement.png',{type:'image/png'}),'portada','Portada reemplazada');assets=await ownerApi.shopAssets(shop);assert.equal(assets.length,1);assert.notEqual(assets[0].id,cover);
 const videoFile=path.join(process.env.RUNNER_TEMP,'synthetic.mp4'),media=spawnSync('ffmpeg',['-loglevel','error','-f','lavfi','-i','color=c=black:s=160x90:d=1','-c:v','libx264','-pix_fmt','yuv420p',videoFile],{encoding:'utf8'});if(media.status!==0)throw Error('Synthetic video generation failed');
 const video=await fs.readFile(videoFile);await uploadContent(owner,shop,new File([video],'synthetic.mp4',{type:'video/mp4'}),'video','Video sintético');
 await adminApi.moderateShop(shop,'aprobar','Contenido y servicio revisados en CI','pendiente');
 const catalogue=await publicApi.catalog();assert.equal(catalogue.length,1);assert.equal(catalogue[0].services[0].price,30);assert.equal(catalogue[0].assets.length,2);
 const publishedVideo=catalogue[0].assets.find(a=>a.kind==='video');assert.deepEqual(Buffer.from(await(await fetch(publishedVideo.url)).arrayBuffer()),video);
 const currentCover=catalogue[0].assets.find(a=>a.kind==='portada');await ownerApi.retireAsset(currentCover.id);
 assert.ok((await anonymous.storage.from(CONTENT_BUCKET).createSignedUrl(currentCover.object_path,300)).error,'Withdrawn content is not newly accessible');
 assert.ok((await serviceClient.storage.from(CONTENT_BUCKET).download(currentCover.object_path)).data,'Withdrawal preserves stored file');
 assert.ok((await anonymous.storage.from(CONTENT_BUCKET).createSignedUrl(first.object_path,300)).error,'Replaced cover remains private');
 phase='published individual availability';
 const date=[2,3,4].map(n=>sumarDias(fechaLima(new Date()),n)).find(d=>new Date(d+'T12:00:00Z').getUTCDay()!==0);
 const slots=await anonymous.rpc('meryo_horarios_barbero',{p_shop:shop,p_service:catalogue[0].services[0].id,p_date:date,p_member:catalogue[0].equipo[0].id});assert.ifError(slots.error);assert.ok(slots.data.length>0,'Approved owner service must expose its actual individual schedule');
 phase='pickup store product visibility and owner photo upload';
 const productPhoto=await ownerApi.uploadProductPhoto(shop,new File([png],'product.png',{type:'image/png'}));
 const hiddenPhoto=await ownerApi.uploadProductPhoto(shop,new File([png],'hidden.png',{type:'image/png'}));
 const productA=await ownerApi.saveProduct(null,{nombre:'Cera sintética CI',descripcion:'Producto de prueba',precio:12,stock_disponible:1,foto_path:productPhoto,publicado:true});
 const productB=await ownerApi.saveProduct(null,{nombre:'Shampoo sintético CI',descripcion:'Segundo producto de prueba',precio:30,stock_disponible:1,foto_path:productPhoto,publicado:true});
 const productC=await ownerApi.saveProduct(null,{nombre:'Spray sintético CI',descripcion:'Sin stock inicial',precio:9,stock_disponible:0,foto_path:productPhoto,publicado:true});
 const hiddenProduct=await ownerApi.saveProduct(null,{nombre:'Oculto sintético CI',descripcion:'No debe mostrarse',precio:5,stock_disponible:4,foto_path:hiddenPhoto,publicado:false});
 assert.ok((await publicApi.shopProducts(shop)).some(p=>p.id===productA));assert.ok(!(await publicApi.shopProducts(shop)).some(p=>p.id===hiddenProduct));
 assert.ok((await owner.from('meryo_products').delete().eq('id',productA)).error,'Product deletion is denied so historical snapshots remain valid');
 assert.ok((await anonymous.storage.from(CONTENT_BUCKET).createSignedUrl(hiddenPhoto,300)).error,'Unpublished product photo stays private');
 assert.ok((await stranger.rpc('meryo_save_product',{p_id:null,p_data:{nombre:'Foreign',precio:5,stock_disponible:1,publicado:true,foto_path:productPhoto}})).error,'A client cannot create or manage another shop products');
 phase='pickup request snapshots and idempotency';
 const requestKey=crypto.randomUUID();let orderA;
 try{orderA=await buyerApi.requestPickup({shop,items:[{productId:productA,quantity:1}],requestKey});}
 catch(error){const raw=await buyer.rpc('meryo_request_pickup',{p_shop:shop,p_items:[{product_id:String(productA),quantity:1}],p_request_key:requestKey});if(raw.error)console.error('Pickup RPC SQL diagnostics '+JSON.stringify({code:raw.error.code,message:raw.error.message,details:raw.error.details,hint:raw.error.hint}));throw error;}
 assert.equal(await buyerApi.requestPickup({shop,items:[{productId:productA,quantity:1}],requestKey}),orderA,'Retrying the same request key returns the same order');
 const orderA2=await buyerTwoApi.requestPickup({shop,items:[{productId:productA,quantity:1}],requestKey:crypto.randomUUID()});
 const atomicOrder=await buyerApi.requestPickup({shop,items:[{productId:productB,quantity:1},{productId:productC,quantity:1}],requestKey:crypto.randomUUID()});
 const priceOrder=await buyerTwoApi.requestPickup({shop,items:[{productId:productB,quantity:1}],requestKey:crypto.randomUUID()});
 const initialOrders=await buyerApi.pickupOrders(orderA);assert.equal(initialOrders[0].estado,'pendiente');assert.equal(Number(initialOrders[0].total),12);assert.equal(Number(initialOrders[0].items[0].precio),12);
 const foreignOrder=await buyerTwoApi.pickupOrders(orderA);assert.equal(foreignOrder.length,0,'A customer sees only their own order');
 assert.equal((await ownerApi.ownerProducts()).find(p=>p.id===productA).stock_disponible,1,'Pending orders do not reserve stock');
 const ownerNotifications=await ownerApi.notifications(ownerId);assert.ok(ownerNotifications.some(n=>n.pedido_id===orderA&&n.tipo==='pedido_solicitado'));
 phase='atomic stock acceptance, price validation and reject';
 const deadline=new Date(Date.now()+120000).toISOString();
 const changedB=await ownerApi.saveProduct(productB,{nombre:'Shampoo sintético CI',descripcion:'Segundo producto de prueba',precio:31,stock_disponible:1,foto_path:productPhoto,publicado:true});assert.equal(changedB,productB);
 await assert.rejects(()=>ownerApi.acceptPickup(priceOrder,deadline),/precio|publicado|producto/i);
 await assert.rejects(()=>ownerApi.acceptPickup(atomicOrder,deadline),/unidades|stock|disponible/i);
 assert.equal((await ownerApi.ownerProducts()).find(p=>p.id===productB).stock_disponible,1,'Atomic rejection does not decrement an earlier in-stock line');
 await ownerApi.saveProduct(productB,{nombre:'Shampoo sintético CI',descripcion:'Segundo producto de prueba',precio:30,stock_disponible:1,foto_path:productPhoto,publicado:true});
 const concurrent=await Promise.allSettled([ownerApi.acceptPickup(orderA,deadline),ownerApi.acceptPickup(orderA2,deadline)]);
 assert.equal(concurrent.filter(result=>result.status==='fulfilled').length,1,'Only one concurrent acceptance reserves the last unit');
 assert.equal(concurrent.filter(result=>result.status==='rejected').length,1);
 const acceptedOrder=concurrent[0].status==='fulfilled'?orderA:orderA2;
 assert.equal((await buyerApi.pickupOrders(orderA)).length,1);
 const deniedOrder=await buyerTwoApi.pickupOrders(orderA);assert.equal(deniedOrder.length,0);
 assert.ok((await stranger.rpc('meryo_accept_pickup_order',{p_id:acceptedOrder,p_deadline:deadline})).error,'A customer cannot accept an order');
 const buyerNotifications=await (acceptedOrder===orderA?buyerApi:buyerTwoApi).pickupOrders(acceptedOrder);assert.equal(buyerNotifications[0].estado,'aceptado');
 phase='server expiry releases stock exactly once';
 await db.query("update public.meryo_pickup_orders set recogida_hasta=clock_timestamp()-interval '1 second' where id=$1",[acceptedOrder]);
 const expired=(acceptedOrder===orderA?await buyerApi.pickupOrders(acceptedOrder):await buyerTwoApi.pickupOrders(acceptedOrder))[0];assert.equal(expired.estado,'vencido');
 assert.equal((await ownerApi.ownerProducts()).find(p=>p.id===productA).stock_disponible,1);
 await (acceptedOrder===orderA?buyerApi.pickupOrders(acceptedOrder):buyerTwoApi.pickupOrders(acceptedOrder));assert.equal((await ownerApi.ownerProducts()).find(p=>p.id===productA).stock_disponible,1,'Repeating expiry does not release the same units twice');
 const loserOrder=acceptedOrder===orderA?orderA2:orderA;const loserApi=loserOrder===orderA?buyerApi:buyerTwoApi;
 await ownerApi.acceptPickup(loserOrder,new Date(Date.now()+120000).toISOString());await ownerApi.cancelPickup(loserOrder);await ownerApi.cancelPickup(loserOrder);
 assert.equal((await ownerApi.ownerProducts()).find(p=>p.id===productA).stock_disponible,1,'Cancellation releases an accepted reservation once');
 phase='pickup delivery and exact notifications';
 await db.query("update meryo_private.push_outbox set status='expired' where event like 'pedido_%'");
 const vapid=webpush.generateVAPIDKeys(),pushConfig={...vapid,subject:'mailto:meryo-isolated@example.invalid'},ownerEndpoint=`https://fcm.googleapis.com/meryo-ci-store/${crypto.randomUUID()}/owner`,buyerEndpoint=`https://fcm.googleapis.com/meryo-ci-store/${crypto.randomUUID()}/buyer`,pushKey=webpush.generateVAPIDKeys().publicKey,pushAuth=crypto.randomBytes(16).toString('base64url'),sent=[];
 await db.query('insert into meryo_private.push_subscriptions(endpoint,user_id,p256dh,auth) values($1,$3,$5,$6),($2,$4,$5,$6)',[ownerEndpoint,buyerEndpoint,ownerId,strangerId,pushKey,pushAuth]);
 const deliveryOrder=await buyerApi.requestPickup({shop,items:[{productId:productB,quantity:1}],requestKey:crypto.randomUUID()});
 const send=async(subscription,payload)=>{sent.push({endpoint:subscription.endpoint,data:JSON.parse(payload)});};
 assert.equal(await deliverBookingPush(db,pushConfig,{send}),'provider_accepted');
 assert.ok(sent.some(push=>push.endpoint===ownerEndpoint&&push.data.event==='pedido_solicitado'&&push.data.orderId===deliveryOrder),'Owner push contains only the requested order route');
 await ownerApi.acceptPickup(deliveryOrder,new Date(Date.now()+120000).toISOString());
 assert.equal(await deliverBookingPush(db,pushConfig,{send}),'provider_accepted');
 assert.ok(sent.some(push=>push.endpoint===buyerEndpoint&&push.data.event==='pedido_aceptado'&&push.data.orderId===deliveryOrder),'Customer push points to the accepted pickup order');
 assert.equal(await ownerApi.deliverPickup(deliveryOrder),'entregado');
 assert.equal((await ownerApi.ownerProducts()).find(p=>p.id===productB).stock_disponible,0,'Delivery records definitive stock outflow');
 const rejectedOrder=await buyerTwoApi.requestPickup({shop,items:[{productId:productC,quantity:1}],requestKey:crypto.randomUUID()});await ownerApi.rejectPickup(rejectedOrder);
 assert.equal((await buyerTwoApi.pickupOrders(rejectedOrder))[0].estado,'rechazado');
 const orderEvents=(await db.query('select event,user_id,pedido_id from meryo_private.push_outbox where pedido_id=$1',[deliveryOrder])).rows;
 assert.ok(orderEvents.some(e=>e.event==='pedido_solicitado'&&e.user_id===ownerId));assert.ok(orderEvents.some(e=>e.event==='pedido_aceptado'&&e.user_id===strangerId));
 assert.ok((await db.query('select count(*)::int n from meryo_private.push_outbox where pedido_id=$1 and event in (\'pedido_solicitado\',\'pedido_aceptado\')',[acceptedOrder])).rows[0].n>=2);
 await db.query('delete from meryo_private.push_subscriptions where endpoint=any($1::text[])',[[ownerEndpoint,buyerEndpoint]]);
 proof={verifiedAt:new Date().toISOString(),officialAuth:true,officialStorage:true,officialPostgrest:true,dockerUsed:false,productionAccess:false,syntheticAccountsOnly:true,uploadAndByteExactDownload:true,privateBeforeApproval:true,crossTenantDenied:true,formatAndSizeDenied:true,replacementAndRetirementPreserveFiles:true,serverMfaApproval:true,publicCatalogueAndVideoVerified:true,availabilityQueried:true,pickupProductsRls:true,pickupPrivatePhotos:true,ordersSnapshotPricesAndIdempotency:true,concurrentAcceptanceNoOversell:true,acceptanceNoPartialStock:true,priceChangeRejectedWithoutMutation:true,serverExpiryReleasesOnce:true,cancelReleasesOnce:true,deliveryConsumesStock:true,orderPushRecipientsVerified:true,legacySignedURLsLifetimeSeconds:300};
 await fs.writeFile(path.join(process.env.RUNNER_TEMP,'meryo-storage-proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
 }
}catch(error){console.error('Isolated Storage verification failed during '+phase+': '+error.message);for(const file of logs){let log=await fs.readFile(file,'utf8').catch(()=>'');for(const value of [jwtSecret,password,anon,service])log=log.replaceAll(value,'[redacted]');console.error(path.basename(file)+'\n'+log.slice(-6000));}process.exitCode=1;}
finally{for(const c of clients)await c.auth.signOut({scope:'local'}).catch(()=>{});if(proxy)await new Promise(resolve=>proxy.close(resolve));for(const c of children)c.kill();await db.end();}
