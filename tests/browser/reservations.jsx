import { useEffect,useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { listaDias } from '../../src/lib/dates';

async function api(path,actor,body){
  const response=await fetch(`/__local/${path}`,{method:body?'POST':'GET',redirect:'error',headers:{'Content-Type':'application/json','X-Meryo-Test-Actor':actor,'X-Meryo-Local-Only':'1'},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();if(!response.ok)throw Error(data.error??'Error local');return data;
}
export default function LocalReservations(){
  const [actor,setActor]=useState('client'),[day,setDay]=useState(listaDias(3)[2]);
  const [slots,setSlots]=useState([]),[rows,setRows]=useState([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const reload=async()=>{const [agenda,reservations]=await Promise.all([api(`agenda?day=${day}`,actor),api('reservations',actor)]);setSlots(agenda);setRows(reservations);};
  useEffect(()=>{let active=true;Promise.all([api(`agenda?day=${day}`,actor),api('reservations',actor)]).then(([a,r])=>{if(active){setSlots(a);setRows(r);}}).catch(e=>{if(active)setMessage(e.message);});return()=>{active=false;};},[actor,day]);
  async function run(path,body){if(busy)return;setBusy(true);setMessage('');try{const r=await api(path,actor,body);setMessage(r.simulated?'Recibo LOCAL verificado: no se cobró dinero':`Guardado por PostgreSQL: ${r.estado??r.id}`);await reload();}catch(e){setMessage(e.message);}finally{setBusy(false);}}
  const button='rounded-xl bg-amber-400 px-4 py-2 font-bold text-black disabled:opacity-40';
  return <main className="min-h-screen bg-neutral-950 p-6 text-white"><div className="mx-auto max-w-5xl space-y-5">
    <p className="text-sm uppercase tracking-widest text-amber-300">MERYO · pruebas aisladas</p><h1 className="text-3xl font-black">Reservas en PostgreSQL local</h1>
    <p className="text-neutral-400">Actores sintéticos sin inicio de sesión real. Este banco no valida Supabase Auth, Storage ni Realtime. Los recibos de prueba no cobran dinero.</p>
    <a className="text-amber-300 underline" href="/">Volver al diseño MERYO</a>
    <div className="flex flex-wrap gap-3"><label>Actor <select className="rounded-xl bg-neutral-800 p-2" value={actor} onChange={e=>{setActor(e.target.value);setMessage('');}}><option value="client">Cliente LOCAL</option><option value="barber">Barbero A LOCAL</option><option value="otherClient">Otro cliente LOCAL</option><option value="otherBarber">Barbero B LOCAL</option></select></label>
    <label>Fecha <input className="rounded-xl bg-neutral-800 p-2" type="date" value={day} onChange={e=>setDay(e.target.value)}/></label><button className={button} onClick={()=>reload().catch(e=>setMessage(e.message))}>Actualizar</button></div>
    <p role="status" className="rounded-xl border border-amber-400/30 p-3">{message||'Sin operaciones pendientes'}</p>
    <section className="rounded-2xl border border-white/10 p-5"><h2 className="font-bold">Corte LOCAL · S/30 · Adelanto S/15</h2><div className="mt-3 flex flex-wrap gap-2">{slots.map(s=><button disabled={busy} className={button} key={s.hora_inicio} onClick={()=>run('request',{start:s.hora_inicio})}>{new Date(s.hora_inicio).toLocaleTimeString('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',hour12:false})}</button>)}</div>{!slots.length&&<p>Sin horarios disponibles para esa fecha.</p>}</section>
    <section className="space-y-3"><h2 className="text-xl font-bold">Reservas visibles para este actor</h2>{rows.map(r=><article className="rounded-2xl border border-white/10 bg-black/30 p-4" key={r.id}><p className="font-bold">{r.estado} · {new Date(r.inicio).toLocaleString('es-PE',{timeZone:'America/Lima'})}</p><p className="text-xs text-neutral-400">{r.id}</p><p>Vence: {r.expira_respuesta_en??r.expira_pago_en??'—'}</p><div className="mt-3 flex flex-wrap gap-2">
    {actor==='barber'&&r.estado==='solicitada'&&<><button disabled={busy} className={button} onClick={()=>run('respond',{id:r.id,accept:true})}>Aceptar manualmente</button><button disabled={busy} className={button} onClick={()=>run('respond',{id:r.id,accept:false})}>Rechazar</button></>}
    {actor==='client'&&r.estado==='aceptada'&&<button disabled={busy} className={button} onClick={()=>run('test-receipt',{id:r.id})}>Simular recibo LOCAL · sin cobro</button>}
    {['solicitada','aceptada'].includes(r.estado)&&<button disabled={busy} className={button} onClick={()=>run('cancel',{id:r.id})}>Cancelar sin pago</button>}
    </div></article>)}{!rows.length&&<p>No hay reservas visibles.</p>}</section>
    <p className="text-xs text-neutral-500">La expiración la ejecuta el proceso local del servidor, aunque cierres esta pestaña. Aceptación: 5 minutos. Pago inicial: 5 minutos. Sin proveedor real ni notificación al celular.</p>
  </div></main>;
}
createRoot(document.getElementById('root')).render(<LocalReservations/>);
