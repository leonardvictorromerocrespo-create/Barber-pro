import {pushRuntime} from '../../server/hosted-push-runtime.mjs';import {handlePushHttp} from '../../server/push-http.mjs';
export const maxDuration=60;
export default async function handler(req,res){let runtime;try{runtime=pushRuntime();await handlePushHttp({req,res,...runtime,action:'worker'});}catch{res.statusCode=503;res.end();}finally{await runtime?.pool.end();}}
