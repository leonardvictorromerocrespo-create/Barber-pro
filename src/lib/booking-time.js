export function remainingSeconds(deadline,serverMs,elapsedMs=0){
 if(!deadline||!Number.isFinite(serverMs))return null;
 return Math.max(0,Math.ceil((Date.parse(deadline)-serverMs-elapsedMs)/1000));
}
export function countdown(seconds){
 if(seconds===null)return 'Consultando plazo del servidor…';
 if(seconds===0)return 'Validando vencimiento en el servidor…';
 return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
}
