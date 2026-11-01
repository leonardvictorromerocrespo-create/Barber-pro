import {useCallback,useEffect,useState} from 'react';
import {pickupOrderIdFromSearch} from '../../lib/booking-link.js';

const names=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const states={pendiente:'Solicitud pendiente de disponibilidad',aceptado:'Aceptado · listo para recoger',rechazado:'Rechazado',cancelado:'Cancelado',vencido:'Plazo de recojo vencido',entregado:'Entregado'};
const money=value=>`S/ ${Number(value||0).toFixed(2)}`;
const when=value=>value?new Date(value).toLocaleString('es-PE',{dateStyle:'medium',timeStyle:'short'}):'—';
function hours(rows){return rows?.length?rows.map(r=>`${names[Number(r.dia)]}: ${String(r.apertura).slice(0,5)}–${String(r.cierre).slice(0,5)}`).join(' · '):'Horario no publicado';}

export default function MyPickupOrders({api,profile,identityLoading,onLogin,onBack}){
 const focus=pickupOrderIdFromSearch(window.location.search),[rows,setRows]=useState([]),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const load=useCallback(async()=>{if(!profile)return;setLoading(true);setError('');try{setRows(await api.pickupOrders(focus));}catch(e){setError(e.message);}finally{setLoading(false);}},[api,focus,profile]);
 useEffect(()=>{load();},[load]);
 return <main className="min-h-screen bg-neutral-950 p-4 text-white sm:p-6"><div className="mx-auto max-w-4xl space-y-5"><header><p className="text-sm text-amber-300">Tienda MERYO</p><h1 className="text-3xl font-black">Mis pedidos</h1></header><button onClick={onBack} className="rounded-xl border border-white/20 px-4 py-2">Volver</button>
  {identityLoading?<p role="status">Comprobando sesión para abrir tu pedido…</p>:!profile?<section className="rounded-2xl border border-white/10 bg-neutral-900 p-5"><p>Inicia sesión para consultar el pedido. Volverás a este mismo detalle después del acceso.</p><button onClick={()=>onLogin('my-orders')} className="mt-4 rounded-xl bg-amber-400 px-4 py-3 font-bold text-black">Continuar con Google o correo</button></section>:profile.rol!=='cliente'?<p role="alert" className="rounded-xl border border-amber-400/20 p-4">Estos pedidos corresponden a cuentas de cliente.</p>:null}
  {error&&<p role="alert" className="rounded-xl border border-red-400/30 p-4 text-red-200">{error}</p>}{loading&&<p role="status">Cargando pedidos…</p>}
  {profile?.rol==='cliente'&&!loading&&!error&&!rows.length&&<p className="rounded-xl border border-dashed border-white/15 p-6 text-neutral-400">{focus?'Este pedido no existe o no está disponible para esta cuenta. Comprueba que iniciaste sesión con la cuenta que lo solicitó.':'Aún no tienes pedidos de recojo.'}</p>}
  {rows.map(order=><article key={order.id} className="space-y-4 rounded-2xl border border-white/10 bg-neutral-900 p-4 sm:p-6"><header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{order.barberias?.nombre}</h2><p className="text-sm text-neutral-400">Pedido {order.id.slice(0,8)}</p></div><p className="rounded-full border border-amber-400/30 px-3 py-1 text-sm text-amber-200">{states[order.estado]||order.estado}</p></header>
   {order.estado==='pendiente'&&<p className="rounded-xl border border-white/10 p-3 text-sm text-neutral-300">El negocio aún está revisando disponibilidad. Todavía no está confirmado ni garantiza unidades. Pagas al recoger en la barbería.</p>}
   <div className="space-y-2">{order.items?.map((item,index)=><div key={`${item.producto_id}-${index}`} className="flex items-center gap-3 rounded-xl border border-white/5 p-3">{item.foto_url&&<img src={item.foto_url} alt="" className="h-14 w-14 rounded-lg object-cover"/>}<div className="flex-1"><p className="font-semibold">{item.nombre} × {item.cantidad}</p><p className="text-sm text-neutral-400">{money(item.precio)} cada uno · {money(item.subtotal)}</p></div></div>)}</div>
   <p className="text-lg font-bold">Total: <span className="text-amber-300">{money(order.total)}</span></p>
   {order.estado==='aceptado'&&<section className="space-y-2 rounded-xl border border-amber-400/25 bg-black/20 p-4"><p className="font-semibold">Pagas al recoger en la barbería</p><p>Dirección: {order.barberias?.direccion||'La barbería no registró dirección.'}</p><p>Horario: {hours(order.horario_recojo)}</p><p>Fecha límite de recojo: <strong>{when(order.recogida_hasta)}</strong></p></section>}
   {order.estado==='cancelado'&&<p className="text-sm text-neutral-300">La barbería canceló la solicitud. No se hizo ningún cobro.</p>}{order.estado==='vencido'&&<p className="text-sm text-neutral-300">El plazo terminó y las unidades reservadas se liberaron. No se hizo ningún cobro.</p>}{order.estado==='rechazado'&&<p className="text-sm text-neutral-300">La barbería no pudo aceptar la solicitud. No se reservaron unidades ni se hizo un cobro.</p>}{order.estado==='entregado'&&<p className="text-sm text-neutral-300">El pedido fue entregado y el pago se realiza presencialmente.</p>}
  </article>)}
 </div></main>;
}
