import {NavigatorLockAcquireTimeoutError} from '@supabase/supabase-js';
// Keep Web Locks' cross-tab mutual exclusion. Never take over an active Auth
// operation: the installed SDK's steal recovery aborts a different request.
export function createNonStealingAuthLock(locks){
 return async(name,acquireTimeout,fn)=>{
  const controller=new AbortController();let timer,acquired=false;
  if(acquireTimeout>0)timer=setTimeout(()=>controller.abort(),acquireTimeout);
  try{return await locks.request(name,acquireTimeout===0?{mode:'exclusive',ifAvailable:true}:{mode:'exclusive',signal:controller.signal},async lock=>{
   clearTimeout(timer);
   if(!lock)throw new NavigatorLockAcquireTimeoutError('La sesión está ocupada en otra pestaña. Espera y vuelve a intentar.');
   acquired=true;
   return await fn();
  });}catch(e){if(e?.name==='AbortError'&&(!acquired||/Lock broken.*steal/i.test(e.message||'')))throw new NavigatorLockAcquireTimeoutError('La sesión sigue ocupada. Cierra otras pestañas MERYO y vuelve a intentar.');throw e;}finally{clearTimeout(timer);}
 };
}
export const browserAuthLockOptions=()=>typeof navigator!=='undefined'&&navigator.locks?{lock:createNonStealingAuthLock(navigator.locks)}:{};
