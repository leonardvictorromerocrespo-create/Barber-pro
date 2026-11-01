import {useEffect,useMemo,useRef,useState} from 'react';
import {clearPickupCart,savePickupCart} from '../../lib/pickup-cart';

const money=value=>`S/ ${Number(value||0).toFixed(2)}`;
function newKey(){return crypto.randomUUID();}

export default function StoreModal({api,shop,profile,initialCart,onLogin,onClose,onOpenOrders}){
 const [products,setProducts]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[success,setSuccess]=useState(''),[createdId,setCreatedId]=useState(null);
 const [cart,setCart]=useState(()=>new Map((initialCart?.items??[]).map(item=>[String(item.productId),item.quantity])));
 const requestKey=useRef(newKey());
 useEffect(()=>{let active=true;setLoading(true);api.shopProducts(shop.id).then(rows=>{if(active){setProducts(rows);setError('');}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[api,shop.id]);
 const selected=useMemo(()=>products.filter(p=>cart.has(String(p.id))).map(p=>({...p,cantidad:cart.get(String(p.id))})),[products,cart]);
 const unavailable=[...cart.keys()].filter(id=>!products.some(product=>String(product.id)===id));
 const overStock=selected.some(product=>product.cantidad>Number(product.stock_disponible));
 const total=selected.reduce((sum,p)=>sum+Number(p.precio)*p.cantidad,0);
 function quantity(id,next){const product=products.find(p=>String(p.id)===String(id));if(!product)return;setCart(current=>{const copy=new Map(current);const value=Math.max(0,Math.min(99,Number(next)||0));if(value===0)copy.delete(String(id));else copy.set(String(id),value);return copy;});requestKey.current=newKey();setSuccess('');}
 async function submit(){
  if(busy||!selected.length)return;
  if(!profile){try{savePickupCart(sessionStorage,{shop:shop.id,category:shop.businessTypes?.includes('belleza')&&!shop.businessTypes?.includes('barberia')?'belleza':'barberia',items:selected.map(p=>({productId:p.id,quantity:p.cantidad}))});onClose();onLogin('store');}catch(e){setError(e.message);}return;}
  if(profile.rol!=='cliente'){setError('Para solicitar productos, inicia sesión con una cuenta de cliente.');return;}
  setBusy(true);setError('');setSuccess('');
  try{const orderId=await api.requestPickup({shop:shop.id,items:selected.map(p=>({productId:p.id,quantity:p.cantidad})),requestKey:requestKey.current});setCreatedId(orderId);clearPickupCart(sessionStorage);setCart(new Map());setSuccess('Solicitud enviada y pendiente de disponibilidad. No garantiza unidades hasta que la barbería la acepte. Pagas al recoger en la barbería.');}
  catch(e){setError(e.message);}
  finally{setBusy(false);}
 }
 return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-3 sm:p-6" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section role="dialog" aria-modal="true" aria-labelledby="meryo-store-title" className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-amber-400/20 bg-neutral-950 p-4 text-white shadow-2xl sm:p-6">
   <header className="flex items-start justify-between gap-4"><div><p className="text-sm text-amber-300">Tienda · recojo en local</p><h2 id="meryo-store-title" className="mt-1 text-2xl font-black">{shop.name}</h2><p className="mt-2 text-sm text-amber-200">Pagas al recoger en la barbería</p></div><button onClick={onClose} className="rounded-xl border border-white/20 px-4 py-2">Cerrar</button></header>
   <p className="mt-4 rounded-xl border border-white/10 bg-neutral-900 p-3 text-sm text-neutral-300">Las solicitudes quedan pendientes de disponibilidad. La barbería confirma las unidades antes del recojo; hasta entonces no se reservan productos.</p>
   {error&&<p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}{unavailable.length>0&&<p role="alert" className="mt-4 rounded-xl border border-amber-400/30 p-3 text-sm text-amber-100">Uno o más productos ya no están publicados. Retíralos de la selección para continuar. <button className="ml-1 underline" onClick={()=>{setCart(current=>new Map([...current].filter(([id])=>!unavailable.includes(id))));requestKey.current=newKey();}}>Quitar productos no disponibles</button></p>}{overStock&&<p role="alert" className="mt-4 text-sm text-amber-100">La cantidad supera el stock visible actual. Ajusta las unidades; aun así, la barbería confirmará disponibilidad antes de reservar.</p>}
   {success&&<div role="status" className="mt-4 rounded-xl border border-amber-400/30 bg-neutral-900 p-4"><p>{success}</p><button onClick={()=>onOpenOrders(createdId)} className="mt-3 rounded-xl bg-amber-400 px-4 py-2 font-bold text-black">Consultar este pedido</button></div>}
   {loading?<p role="status" className="py-12 text-center text-neutral-400">Cargando productos…</p>:!products.length?<p className="mt-5 rounded-2xl border border-dashed border-white/15 p-8 text-center text-neutral-400">Esta barbería todavía no tiene productos publicados.</p>:<div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{products.map(p=><article key={p.id} className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-900">
    {p.foto_url?<img src={p.foto_url} alt={p.nombre} className="h-44 w-full object-cover"/>:<div className="flex h-36 items-center justify-center bg-black/30 text-sm text-neutral-500">Foto no disponible</div>}
    <div className="space-y-2 p-4"><h3 className="font-bold">{p.nombre}</h3>{p.descripcion&&<p className="text-sm text-neutral-300">{p.descripcion}</p>}<p className="font-semibold text-amber-300">{money(p.precio)}</p><p className="text-xs text-neutral-400">{p.stock_disponible>0?`Disponible: ${p.stock_disponible} · se confirma al aceptar`:'Sin unidades disponibles'}</p>
     <div className="flex items-center gap-3"><button aria-label={`Quitar ${p.nombre}`} disabled={!cart.has(String(p.id))} onClick={()=>quantity(p.id,(cart.get(String(p.id))||0)-1)} className="h-10 w-10 rounded-lg border border-white/20 disabled:opacity-40">−</button><span aria-live="polite" className="min-w-7 text-center">{cart.get(String(p.id))||0}</span><button aria-label={`Añadir ${p.nombre}`} disabled={p.stock_disponible<1||(cart.get(String(p.id))||0)>=p.stock_disponible} onClick={()=>quantity(p.id,(cart.get(String(p.id))||0)+1)} className="h-10 w-10 rounded-lg border border-white/20 disabled:opacity-40">+</button></div>
    </div></article>)}</div>}
   <footer className="sticky bottom-0 mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-neutral-950/95 pt-4"><p className="text-lg font-bold">Total de referencia: <span className="text-amber-300">{money(total)}</span></p><button disabled={busy||!selected.length||loading||success||unavailable.length>0||overStock} onClick={submit} className="rounded-xl bg-amber-400 px-5 py-3 font-bold text-black disabled:cursor-not-allowed disabled:opacity-40">{busy?'Enviando…':'Solicitar para recoger'}</button></footer>
  </section>
 </div>;
}
