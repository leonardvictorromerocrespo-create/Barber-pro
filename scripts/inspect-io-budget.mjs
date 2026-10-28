// Bounded existing counters only. No exports, EXPLAIN ANALYZE, resets or writes.
import fs from 'node:fs/promises';import path from 'node:path';import pg from 'pg';
const root=path.join(process.env.LOCALAPPDATA,'MERYO-deployment'),phase=process.argv[2]||'before';
if(!['before','after'].includes(phase))throw Error('Use before or after');
const config=JSON.parse(await fs.readFile(path.join(root,'hosted-source.json'),'utf8'));
if(config.projectRef!=='prdmcjykjpxpcomonwuy'||config.ssl?.rejectUnauthorized!==true)throw Error('Unexpected project');
const db=new pg.Client({...config,application_name:'meryo_io_readonly'}),proof={};await db.connect();
async function read(name,sql){try{proof[name]=(await db.query(sql)).rows;}catch(e){proof[name]={unavailable:e.code};}}
try{
 await db.query("set default_transaction_read_only=on;set statement_timeout='5s';set lock_timeout='1s'");
 await read('database',"select clock_timestamp() as measured_at,stats_reset,xact_commit,xact_rollback,blks_read,blks_hit,temp_files,temp_bytes,blk_read_time,blk_write_time from pg_stat_database where datname=current_database()");
 await read('statementView',"select schemaname from pg_views where viewname='pg_stat_statements' limit 1");
 const schema=proof.statementView[0]?.schemaname;
 const category=`case when query ilike '%meryo_reservas_estado%' then 'booking_snapshot' when query ilike '%meryo_push_admin_estado%' then 'push_admin_state' when query ilike '%meryo_push_estado%' then 'personal_push_state' when query ilike '%expirar_reservas_vencidas%' then 'booking_expiration' when query ilike '%wake_push%' then 'push_dispatch_wake' when query ilike '%meryo_private.push_outbox%' then 'push_outbox' when query ilike '%net.http_post%' then 'pg_net_request' when query ilike '%COPY %TO STDOUT%' then 'copy_export' when query ilike '%pg_export_snapshot%' then 'backup_snapshot' when query ilike '%notificaciones%' then 'notifications' when query ilike '%meryo_admin_reservas%' then 'admin_booking_read' when query ilike '%horarios%' then 'availability' when query ilike '%pg_catalog%' then 'catalog_metadata' else 'other' end category`;
 if(schema&&/^[a-z_]+$/.test(schema)){
  const fields=`queryid,calls,round(total_exec_time::numeric,1) total_ms,round(mean_exec_time::numeric,2) mean_ms,shared_blks_read,shared_blks_hit,shared_blks_written,temp_blks_written,wal_bytes::text,${category}`;
  await read('statements',`select ${fields} from ${schema}.pg_stat_statements order by shared_blks_read desc,total_exec_time desc limit 20`);
  await read('statementsByCalls',`select ${fields} from ${schema}.pg_stat_statements order by calls desc limit 15`);
 }
 await read('jobs',"select jobid,jobname,schedule,active from cron.job order by jobid");
 await read('jobRuns',"select jobid,date_trunc('hour',start_time) as hour,status,count(*)::int runs,round(avg(extract(epoch from end_time-start_time))::numeric,3) avg_seconds from cron.job_run_details where start_time>clock_timestamp()-interval '6 hours' group by jobid,2,status order by 2 desc,jobid limit 30");
 await read('tableEstimates',"select schemaname,relname,n_live_tup,n_dead_tup,seq_scan,idx_scan from pg_stat_user_tables where schemaname in ('public','meryo_private','net','cron') order by seq_scan desc limit 15");
 await fs.writeFile(path.join(root,`io-budget-${phase}.json`),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{await db.end();}
