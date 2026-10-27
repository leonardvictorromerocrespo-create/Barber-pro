export function limaInputInstant(value){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Completa fecha y hora de Lima');
 const date=new Date(value+':00-05:00');if(!Number.isFinite(date.getTime())||new Date(date.getTime()-5*3600000).toISOString().slice(0,16)!==value)throw Error('Fecha inválida');return date.toISOString();
}
