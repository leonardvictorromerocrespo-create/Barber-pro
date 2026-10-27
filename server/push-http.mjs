import crypto from 'node:crypto';
import {acknowledgePush,deliverBookingPush} from './web-push.mjs';
export function authorizedWorker(header,secret){const provided=Buffer.from(String(header||'')),expected=Buffer.from('Bearer '+String(secret||''));return Boolean(secret?.length>=43)&&provided.length===expected.length&&crypto.timingSafeEqual(provided,expected);}
export async function runPushBatch(pool,config){const started=Date.now(),result={processed:0,providerAccepted:0,retries:0};while(result.processed<10&&Date.now()-started<15000){const status=await deliverBookingPush(pool,config);if(['idle','not_configured'].includes(status))break;result.processed++;if(status==='provider_accepted')result.providerAccepted++;if(status==='retry')result.retries++;}return result;}
export async function handlePushHttp({req,res,pool,config,action}){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST'){res.statusCode=405;res.end();return;}
 if(action==='worker'){
  if(!authorizedWorker(req.headers.authorization,config.workerSecret)){res.statusCode=401;res.end();return;}
  try{res.statusCode=200;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await runPushBatch(pool,config)));}catch{res.statusCode=503;res.end('Push worker unavailable');}return;
 }
 try{let body=req.body;if(!body){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1024){res.statusCode=413;res.end();return;}}body=JSON.parse(raw);}if(typeof body==='string')body=JSON.parse(body);const ok=await acknowledgePush(pool,body);res.statusCode=ok?204:403;}catch{res.statusCode=400;}res.end();
}
