// Runs independently of browser tabs. Use a dedicated server process/job in deployment.
export function startReservationMaintenance(pool,{intervalMs=2000,onError=()=>{}}={}) {
 let running=false,stopped=false;
 async function tick(){
  if(running||stopped)return;
  running=true;
  try{await pool.query('select public.expirar_reservas_vencidas()');}
  catch{onError('No se pudo ejecutar el vencimiento de reservas');}
  finally{running=false;}
 }
 const timer=setInterval(tick,intervalMs);void tick();
 return async()=>{stopped=true;clearInterval(timer);while(running)await new Promise(r=>setTimeout(r,20));};
}
