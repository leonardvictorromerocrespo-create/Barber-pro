const upcomingStates=new Set(['solicitada','aceptada','confirmada']);
const dateFormat=new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',weekday:'long',day:'numeric',month:'long',year:'numeric'});
const timeFormat=new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',hour12:false});
const moneyFormat=new Intl.NumberFormat('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});

export function splitBookingRows(rows,now=Date.now()){
 const upcoming=[],history=[];
 for(const row of rows){
  const timestamp=Date.parse(row.inicio);
  if(upcomingStates.has(row.estado)&&Number.isFinite(timestamp)&&timestamp>now)upcoming.push(row);
  else history.push(row);
 }
 upcoming.sort((a,b)=>Date.parse(a.inicio)-Date.parse(b.inicio));
 history.sort((a,b)=>Date.parse(b.inicio)-Date.parse(a.inicio));
 return {upcoming,history};
}

export function readableBookingDate(value){
 const date=new Date(value);
 if(!Number.isFinite(date.getTime()))return {date:'Fecha no disponible',time:''};
 return {date:dateFormat.format(date),time:timeFormat.format(date)};
}

export function bookingMoney(value){
 const amount=Number(value);
 return value===null||value===undefined||value===''||!Number.isFinite(amount)?'No disponible':`S/ ${moneyFormat.format(amount)}`;
}
