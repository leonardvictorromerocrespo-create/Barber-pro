import {useEffect,useMemo,useRef,useState} from 'react';
import {clearPickupCart,savePickupCart} from '../../lib/pickup-cart';

const money=value=>`S/ ${Number(value||0).toFixed(2)}`;
function newKey(){return crypto.randomUUID();}

export function StoreProductGrid({products,cart,onOpen}){
 return <div className="meryo-store-grid" data-testid="store-product-grid">{products.map(product=>{
  const quantity=cart.get(String(product.id))||0;
  return <article key={product.id} className={`meryo-store-product${quantity?' is-selected':''}`}>
   <button type="button" className="meryo-store-product-open" aria-label={`Ver ${product.nombre}, ${money(product.precio)}`} aria-haspopup="dialog" aria-pressed={quantity>0} onClick={()=>onOpen(product)}>
    {product.foto_url?<img src={product.foto_url} alt={product.nombre} className="meryo-store-product-photo" loading="lazy"/>:<span className="meryo-store-product-photo meryo-store-product-placeholder" aria-label="Foto no disponible">Foto no disponible</span>}
    <span className="meryo-store-product-copy"><span className="meryo-store-product-name">{product.nombre}</span><span className="meryo-store-product-price">{money(product.precio)}</span></span>
    {quantity>0&&<span className="meryo-store-product-count" aria-label={`${quantity} seleccionados`}>{quantity}</span>}
   </button>
  </article>;
 })}</div>;
}

export default function StoreModal({api,shop,profile,initialCart,onLogin,onClose,onOpenOrders,category='barberia',themeMode='dark',themeAppearance}){
 const [products,setProducts]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[reloadToken,setReloadToken]=useState(0),[busy,setBusy]=useState(false),[success,setSuccess]=useState(''),[createdId,setCreatedId]=useState(null);
 const [cart,setCart]=useState(()=>new Map((initialCart?.items??[]).map(item=>[String(item.productId),item.quantity]))),[detail,setDetail]=useState(null);
 const requestKey=useRef(newKey());
 useEffect(()=>{let active=true;setLoading(true);setError('');api.shopProducts(shop.id).then(rows=>{if(active){if(!Array.isArray(rows))throw new Error('La tienda devolvió una lista inválida.');setProducts(rows);setError('');}}).catch(e=>{if(active){setProducts([]);setError(e.message||'No se pudieron cargar los productos.');}}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[api,shop.id,reloadToken]);
 const selected=useMemo(()=>products.filter(p=>cart.has(String(p.id))).map(p=>({...p,cantidad:cart.get(String(p.id))})),[products,cart]);
 const unavailable=loading?[]:[...cart.keys()].filter(id=>!products.some(product=>String(product.id)===id));
 const overStock=selected.some(product=>product.cantidad>Number(product.stock_disponible));
 const total=selected.reduce((sum,p)=>sum+Number(p.precio)*p.cantidad,0);
 function quantity(id,next){const product=products.find(p=>String(p.id)===String(id));if(!product)return;setCart(current=>{const copy=new Map(current);const value=Math.max(0,Math.min(99,Number(next)||0));if(value===0)copy.delete(String(id));else copy.set(String(id),value);return copy;});requestKey.current=newKey();setSuccess('');}
 async function submit(){
  if(busy||!selected.length)return;
  if(!profile){try{savePickupCart(sessionStorage,{shop:shop.id,category,items:selected.map(p=>({productId:p.id,quantity:p.cantidad}))});onClose();onLogin('store');}catch(e){setError(e.message);}return;}
  if(profile.rol!=='cliente'){setError('Para solicitar productos, inicia sesión con una cuenta de cliente.');return;}
  setBusy(true);setError('');setSuccess('');
  try{const orderId=await api.requestPickup({shop:shop.id,items:selected.map(p=>({productId:p.id,quantity:p.cantidad})),requestKey:requestKey.current});setCreatedId(orderId);clearPickupCart(sessionStorage);setCart(new Map());setSuccess('Solicitud enviada y pendiente de disponibilidad. No garantiza unidades hasta que la barbería la acepte. Pagas al recoger en la barbería.');setDetail(null);}
  catch(e){setError(e.message);}
  finally{setBusy(false);}
 }
 const detailQuantity=detail?(cart.get(String(detail.id))||0):0;
 const availability=detail&&Number(detail.stock_disponible)>0?`Disponible: ${detail.stock_disponible}. Se confirma al aceptar.`:'Sin unidades disponibles.';
 return <div data-meryo-theme={category==='belleza'?'beauty':'barberia'} data-meryo-mode={themeMode} data-meryo-appearance={themeAppearance} className="meryo-storefront fixed inset-0 z-[70]" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section role="dialog" aria-modal="true" aria-labelledby="meryo-store-title" className="meryo-store-dialog">
   <header className="meryo-store-header">
    <div className="meryo-store-heading"><p>Tienda · recojo en local</p><h2 id="meryo-store-title">{shop.name}</h2><span>Pagas al recoger · solicitud pendiente de disponibilidad</span></div>
    <button type="button" onClick={onClose} className="meryo-store-close">Cerrar</button>
   </header>
   {error&&<div role="alert" className="meryo-store-alert">{error}{!loading&&<button type="button" onClick={()=>setReloadToken(value=>value+1)}>Reintentar</button>}</div>}
   {unavailable.length>0&&<p role="alert" className="meryo-store-alert">Uno o más productos ya no están publicados. Retíralos de la selección para continuar. <button type="button" onClick={()=>{setCart(current=>new Map([...current].filter(([id])=>!unavailable.includes(id))));requestKey.current=newKey();}}>Quitar productos no disponibles</button></p>}
   {overStock&&<p role="alert" className="meryo-store-alert">La cantidad supera el stock visible actual. Ajusta las unidades; la barbería confirmará disponibilidad antes de aceptar.</p>}
   {success&&<div role="status" className="meryo-store-success"><p>{success}</p><button type="button" onClick={()=>onOpenOrders(createdId)}>Consultar este pedido</button></div>}
   <main className="meryo-store-scroll">
    {loading?<p role="status" className="meryo-store-state">Cargando productos…</p>:error?null:!products.length?<p className="meryo-store-state">Esta barbería todavía no tiene productos publicados.</p>:detail?<section className="meryo-store-detail" aria-label={`Detalle de ${detail.nombre}`}>
     <button type="button" className="meryo-store-back" onClick={()=>setDetail(null)}>← Volver a productos</button>
     <div className="meryo-store-detail-content">
      {detail.foto_url?<img src={detail.foto_url} alt={detail.nombre} className="meryo-store-detail-photo"/>:<div className="meryo-store-detail-photo meryo-store-product-placeholder">Foto no disponible</div>}
      <div className="meryo-store-detail-copy"><h3>{detail.nombre}</h3><p className="meryo-store-detail-price">{money(detail.precio)}</p>{detail.descripcion&&<p className="meryo-store-detail-description">{detail.descripcion}</p>}<p className="meryo-store-availability">{availability} Hasta que se acepte el pedido no se reservan unidades.</p>
       <div className="meryo-store-quantity" aria-label={`Cantidad de ${detail.nombre}`}><button type="button" aria-label={`Quitar ${detail.nombre}`} disabled={detailQuantity<1} onClick={()=>quantity(detail.id,detailQuantity-1)}>−</button><output aria-live="polite">{detailQuantity}</output><button type="button" aria-label={`Añadir ${detail.nombre}`} disabled={Number(detail.stock_disponible)<1||detailQuantity>=Number(detail.stock_disponible)||detailQuantity>=99} onClick={()=>quantity(detail.id,detailQuantity+1)}>+</button></div>
       <button type="button" className="meryo-store-detail-done" onClick={()=>setDetail(null)}>Listo</button>
      </div>
     </div>
    </section>:<StoreProductGrid products={products} cart={cart} onOpen={setDetail}/>}
   </main>
   <footer className="meryo-store-footer"><p><span>{selected.length} {selected.length===1?'producto':'productos'}</span><strong>Total: {money(total)}</strong></p><button type="button" disabled={busy||!selected.length||loading||Boolean(success)||unavailable.length>0||overStock||Boolean(error)} onClick={submit}>{busy?'Enviando…':'Solicitar para recoger'}</button></footer>
  </section>
 </div>;
}
