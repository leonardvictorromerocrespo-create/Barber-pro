import {fechaLima} from './dates.js';

export const EXTERNAL_PREFIX='Cita externa · ';
const active=new Set(['solicitada','aceptada','confirmada']);
const minutes=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export const limaHour=value=>minutes.format(new Date(value));
const startOf=item=>Date.parse(item.inicio??item.starts);
const endOf=item=>Date.parse(item.fin??item.ends);
export const overlaps=(a,b,item)=>a<endOf(item)&&b>startOf(item);

export function dayAgenda(rows,blocks,memberId,day,now){
 const scoped=rows.filter(row=>String(row.barbero_id)===String(memberId)&&Number.isFinite(startOf(row)));
 const pending=scoped.filter(row=>row.estado==='solicitada'&&row.puede_responder===true)
   .sort((a,b)=>Date.parse(a.expira_respuesta_en)-Date.parse(b.expira_respuesta_en));
 const a=Date.parse(day+'T00:00:00-05:00'),b=a+86400000;
 const reservations=scoped.filter(row=>overlaps(a,b,row));
 const holds=blocks.filter(block=>block.active!==false&&overlaps(a,b,block));
 const timeline=[
  ...reservations.map(row=>({id:'r-'+row.id,kind:'booking',start:startOf(row),row})),
  ...holds.map(row=>({id:'b-'+row.id,kind:row.reason?.startsWith(EXTERNAL_PREFIX)?'external':'block',start:startOf(row),row})),
 ].sort((x,y)=>x.start-y.start);
 const occupied=[...scoped.filter(row=>active.has(row.estado)),...holds];
 return {pending,timeline,occupied,confirmed:reservations.filter(row=>row.estado==='confirmada').length,
  external:timeline.filter(item=>item.kind==='external').length,
  next:timeline.find(item=>item.start>=now&&(item.kind==='external'||(item.kind==='booking'&&item.row.estado==='confirmada')))};
}

export function availableAgendaStarts(slots,day,now){
 return slots.filter(slot=>!slot.occupied&&Date.parse(slot.time)>=now&&fechaLima(slot.time)===day);
}
