// One-shot, additive release for the approved salon catalog. Production is
// unreachable unless --apply-hosted is explicit and a recent backup is proven.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import pg from 'pg';

const repo='leonardvictorromerocrespo-create/Barber-pro';
const version='20261101000022';
const apply=process.argv.includes('--apply-hosted');
const runIndex=process.argv.indexOf('--backup-run-id');
const runId=runIndex>=0?process.argv[runIndex+1]:'';
if(!apply)throw Error('No se ejecutó: indica --apply-hosted explícitamente después de aprobar la verificación aislada.');
if(!/^\d{8,}$/.test(runId))throw Error('Falta --backup-run-id del respaldo externo verificado.');

const root=path.join(process.env.LOCALAPPDATA,'MERYO-deployment');
const hosted=JSON.parse(await fs.readFile(path.join(root,'hosted-source.json'),'utf8'));
if(hosted.projectRef!=='prdmcjykjpxpcomonwuy'||hosted.host!=='aws-1-us-east-2.pooler.supabase.com'||hosted.user!=='postgres.prdmcjykjpxpcomonwuy'||hosted.ssl?.rejectUnauthorized!==true)throw Error('Destino Supabase no coincide; no se abrió conexión.');

const backup=JSON.parse(execFileSync('gh',['run','view',runId,'--repo',repo,'--json','workflowName,status,conclusion,createdAt,headBranch'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
if(backup.workflowName!=='MERYO hosted backup'||backup.status!=='completed'||backup.conclusion!=='success'||backup.headBranch!=='main')throw Error('El respaldo externo elegido no terminó correctamente en el flujo esperado.');
if(Date.now()-Date.parse(backup.createdAt)>48*60*60*1000)throw Error('El respaldo externo tiene más de 48 horas.');

const sql=await fs.readFile('db/incremental/022_beauty_business_catalog.sql','utf8');
const sha256=createHash('sha256').update(sql).digest('hex');
const db=new pg.Client(hosted);
const protectedTables=['profiles','barberias','servicios','reservas','pagos','meryo_products','meryo_pickup_orders','meryo_pickup_order_items'];
const trackedFunctions=[
 'public.es_admin()','public.registrar_barberia(text,text,text,text,double precision,double precision,text,text)',
 'public.meryo_admin_barberias()','public.meryo_moderar_barberia(bigint,text,text,text)',
 'public.meryo_solicitar_cita(bigint,bigint,timestamp with time zone,text,text,text,numeric,uuid)',
 'public.meryo_reservas_config()'
];
async function counts(){const result={};for(const name of protectedTables)result[name]=(await db.query(`select count(*)::text n from public.${name}`)).rows[0].n;return result;}
async function functionHashes(){const result={};for(const signature of trackedFunctions){const row=await db.query('select md5(pg_get_functiondef($1::regprocedure)) value',[signature]);result[signature]=row.rows[0].value;}return result;}

try{
 await db.connect();
 await db.query('begin');
 await db.query("set local lock_timeout='5s'; set local statement_timeout='45s'; select pg_advisory_xact_lock(hashtextextended('meryo-beauty-business-20261101',0))");
 const applied=(await db.query('select version from supabase_migrations.schema_migrations where version=$1',[version])).rowCount;
 if(applied)throw Error('Migración 022 ya registrada; no se repetirá.');
 if(!(await db.query("select to_regprocedure('public.registrar_barberia(text,text,text,text,double precision,double precision,text,text)') is not null and to_regprocedure('public.meryo_catalogo_publico()') is not null and to_regprocedure('public.meryo_moderar_barberia(bigint,text,text,text)') is not null as base_ready")).rows[0].base_ready)throw Error('El contrato base cambió; se cancela sin aplicar.');
 if(!(await db.query("select to_regclass('public.meryo_products') is not null and to_regclass('public.meryo_pickup_orders') is not null as store_ready")).rows[0].store_ready)throw Error('Falta la tienda existente; se cancela sin aplicar.');
 if(!(await db.query("select exists(select 1 from supabase_migrations.schema_migrations where version='20261101000021') as migration_021")).rows[0].migration_021)throw Error('Falta el registro de la tienda; se cancela sin aplicar.');
 const beforeCounts=await counts(),beforeFunctions=await functionHashes();
 const booking=(await db.query('select public.meryo_reservas_config() config')).rows[0].config;
 if(booking.respuesta_segundos!==900||booking.plazo_pago_segundos!==600||booking.cobros_habilitados!==false)throw Error('Los plazos o el bloqueo de cobros no coinciden con lo aprobado.');
 const statements=sql.replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,'');
 await db.query(statements);
 await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[version,'meryo_022_beauty_business_catalog',[`-- sha256: ${sha256}\n${sql}`]]);
 const afterCounts=await counts();if(JSON.stringify(beforeCounts)!==JSON.stringify(afterCounts))throw Error('Cambió un conteo de datos protegido; transacción revertida.');
 if(JSON.stringify(beforeFunctions)!==JSON.stringify(await functionHashes()))throw Error('Cambió un contrato de Auth, MFA, reservas, plazos o configuración; transacción revertida.');
 const categories=(await db.query("select count(*) filter(where tipos_negocio<>array['barberia']::text[])::int non_barber_defaults from public.barberias")).rows[0];
 if(categories.non_barber_defaults!==0)throw Error('Algún negocio existente no quedó clasificado solo como barbería.');
 const security=(await db.query("select (select relrowsecurity from pg_class where oid='public.barberias'::regclass) shop_rls,(select relrowsecurity from pg_class where oid='public.servicios'::regclass) service_rls,has_function_privilege('anon','public.registrar_negocio(text,text,text,text,double precision,double precision,text,text,text)','execute') anon_registration,has_function_privilege('authenticated','public.registrar_negocio(text,text,text,text,double precision,double precision,text,text,text)','execute') owner_registration,has_function_privilege('anon','public.meryo_catalogo_categoria(text)','execute') public_category_catalog,has_function_privilege('authenticated','public.meryo_catalogo_categoria(text)','execute') private_category_catalog,exists(select 1 from pg_trigger where tgrelid='public.reservas'::regclass and tgname='meryo_reserva_servicio_reservable' and tgenabled<>'D') reservation_guard")).rows[0];
 if(!security.shop_rls||!security.service_rls||security.anon_registration||!security.owner_registration||!security.public_category_catalog||!security.private_category_catalog||!security.reservation_guard)throw Error('La comprobación de RLS, permisos o guardia de reserva falló.');
 if(booking.respuesta_segundos!==900||booking.plazo_pago_segundos!==600||booking.cobros_habilitados!==false)throw Error('Configuración comercial inesperada.');
 await db.query("notify pgrst,'reload schema'");
 await db.query('commit');
 console.log(JSON.stringify({applied:true,project:'prdmcjykjpxpcomonwuy',version,sha256,backupRunId:runId,backupCreatedAt:backup.createdAt,protectedCounts:afterCounts,legacyBusinessesDefaultToBarberia:categories.non_barber_defaults===0,booking:{responseSeconds:booking.respuesta_segundos,paymentSeconds:booking.plazo_pago_segundos,livePaymentsEnabled:booking.cobros_habilitados},security}));
}catch(error){try{await db.query('rollback');}catch{}console.error('Migración revertida: '+error.message);process.exitCode=1;}
finally{await db.end().catch(()=>{});}
