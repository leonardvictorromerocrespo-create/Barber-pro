// Read refresh only. Server deadlines, RLS and writes do not depend on this timer.
export function visiblePolling(task,{intervalMs=15000,document=globalThis.document,window=globalThis.window,setInterval=globalThis.setInterval,clearInterval=globalThis.clearInterval}={}){
 let stopped=false,flight=null,queued=null;
 const visible=()=>document?.visibilityState!=='hidden';
 function refresh(force=false){
  if(stopped||!visible())return Promise.resolve();
  if(flight){
   if(!force)return flight;
   if(!queued)queued=flight.catch(()=>{}).then(()=>{queued=null;return refresh();});
   return queued;
  }
  flight=Promise.resolve().then(()=>{if(!stopped&&visible())return task();}).finally(()=>{flight=null;});
  return flight;
 }
 const tick=()=>{void refresh().catch(()=>{});};
 const timer=setInterval(tick,intervalMs);document?.addEventListener('visibilitychange',tick);window?.addEventListener('focus',tick);tick();
 return {refresh:()=>refresh(true),stop(){stopped=true;clearInterval(timer);document?.removeEventListener('visibilitychange',tick);window?.removeEventListener('focus',tick);}};
}
