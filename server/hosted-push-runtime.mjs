import pg from 'pg';
export function pushRuntime(){
 const db=JSON.parse(process.env.MERYO_PUSH_DB||'null'),config=JSON.parse(process.env.MERYO_PUSH_CONFIG||'null');
 if(!db||!config||db.projectRef!=='prdmcjykjpxpcomonwuy'||db.host!=='aws-1-us-east-2.pooler.supabase.com'||db.ssl?.rejectUnauthorized!==true||!config.workerSecret||!config.privateKey)throw Error('Verified hosted push configuration required');
 return {pool:new pg.Pool({...db,max:1,idleTimeoutMillis:5000,connectionTimeoutMillis:8000}),config};
}
