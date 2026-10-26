// Authorized read-only connection check. Does not reset passwords or alter SQL.
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
let input='',client;
try{
 const root=path.join(process.env.LOCALAPPDATA,'MERYO-deployment');
 const ca=await fs.readFile(path.join(root,'supabase-ca.crt'),'utf8');
 for await(const chunk of process.stdin){input+=chunk;if(input.length>10000)throw Error('Invalid private input');}
 const {password}=JSON.parse(input);input='';if(!password)throw Error('A database password is required');
 const config={host:'aws-1-us-east-2.pooler.supabase.com',port:5432,database:'postgres',user:'postgres.prdmcjykjpxpcomonwuy',password,ssl:{rejectUnauthorized:true,ca},connectionTimeoutMillis:20000,query_timeout:20000};
 client=new pg.Client(config);await client.connect();await client.query('begin read only');
 const {rows:[identity]}=await client.query("select current_database() database,current_user role,current_setting('server_version') version,to_regclass('public.barberias') is not null shops,to_regclass('public.profiles') is not null profiles");
 if(identity.database!=='postgres'||!identity.shops||!identity.profiles)throw Error('Unexpected destination');
 await client.query('rollback');
 await fs.mkdir(root,{recursive:true});
 await fs.writeFile(path.join(root,'hosted-source.json'),JSON.stringify({...config,projectRef:'prdmcjykjpxpcomonwuy'}),{flag:'wx',mode:0o600});
 await fs.writeFile(path.join(root,'connection-status.json'),JSON.stringify({verifiedAt:new Date().toISOString(),projectRef:'prdmcjykjpxpcomonwuy',readOnly:true,version:identity.version}));
 console.log('Conexion SQL real verificada SOLO en lectura. Credencial guardada privadamente; sin migraciones.');
}catch(error){console.error('Conexion no guardada. Codigo: '+(error.code||'CHECK_FAILED')+'. No se mostraron credenciales ni se modifico la base.');process.exitCode=1;}
finally{if(client)await client.end().catch(()=>{});}
