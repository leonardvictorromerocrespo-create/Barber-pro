import {useCallback,useEffect,useState} from 'react';
import {Cargando,Mensaje,btnGhost,btnPrimary,card,inputClass} from './ui';

function limaToday(){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
 return `${values.year}-${values.month}-${values.day}`;
}
const emptyForm=()=>({serviceId:'',promoPrice:'',startsOn:limaToday(),endsOn:limaToday(),active:true});
const money=value=>Number(value).toFixed(2);

export default function SalonPromotions({api}){
 const [data,setData]=useState(null),[form,setForm]=useState(emptyForm),[editing,setEditing]=useState(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);
  try{setData(await api.ownerBeautyPromotions());setError('');}
  catch(reason){setError(reason.message);setData(null);}
  finally{setLoading(false);}
 },[api]);
 useEffect(()=>{void load();},[load]);
 const services=data?.services||[],offers=data?.promotions||[];
 const selected=services.find(service=>String(service.id)===String(form.serviceId));
 const pausingHiddenOffer=Boolean(editing&&!form.active&&offers.some(offer=>String(offer.id)===String(editing)));
 function newOffer(){setEditing(null);setForm(emptyForm());setError('');setMessage('');}
 function editOffer(offer){
  setEditing(offer.id);setForm({serviceId:String(offer.service_id),promoPrice:String(offer.promo_price),startsOn:offer.starts_on,endsOn:offer.ends_on,active:offer.active===true});setError('');setMessage('');
 }
 async function save(event){
  event.preventDefault();if(busy)return;setError('');setMessage('');
  if(!form.serviceId)return setError('Elige un servicio publicado.');
  const price=Number(form.promoPrice),regular=Number(selected?.precio);
  if(form.active&&!(selected&&price>0&&price<regular))return setError('El precio promocional debe ser mayor que cero y menor al precio habitual del servicio publicado.');
  if(!form.active&&!pausingHiddenOffer&&!(selected&&price>0&&price<regular))return setError('El precio promocional debe ser mayor que cero y menor al precio habitual.');
  if(!form.startsOn||!form.endsOn||form.endsOn<form.startsOn)return setError('Revisa las fechas de vigencia.');
  setBusy(true);
  try{
   await api.saveBeautyPromotion({serviceId:form.serviceId,promoPrice:price,startsOn:form.startsOn,endsOn:form.endsOn,active:form.active});
   await load();setEditing(null);setForm(emptyForm());setMessage(form.active?'Promoción del salón guardada.':'Promoción pausada.');
  }catch(reason){setError(reason.message);}
  finally{setBusy(false);}
 }
 if(loading)return <Cargando texto="Cargando promociones del salón…"/>;
 return <section className="space-y-5" aria-labelledby="salon-promotions-title">
  <header className={`${card} space-y-2`}><h2 id="salon-promotions-title" className="text-xl font-bold">Promociones del salón</h2><p className="text-sm text-neutral-400">Elige un servicio publicado, su precio promocional y un día de inicio. La oferta se repite ese día de la semana hasta la fecha final. Cada negocio puede tener un solo día promocional por semana, compartido con Cortes al 50 %; el descuento de belleza lo defines tú.</p></header>
  <Mensaje>{error}</Mensaje><Mensaje tipo="ok">{message}</Mensaje>
  {offers.length>0&&<section className={`${card} space-y-3`} aria-label="Ofertas configuradas"><h3 className="font-semibold">Ofertas configuradas</h3>{offers.map(offer=>{
   const status=!offer.active?'Pausada':offer.expired?'Vencida':!offer.service_published?'Servicio oculto':offer.price_changed?'Revisar precio habitual':'Activa';
   return <article key={offer.id} className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{offer.service_name||`Servicio ${offer.service_id}`}</p><p className="mt-1 text-sm text-neutral-400"><span className="line-through">S/ {offer.regular_price==null?'—':money(offer.regular_price)}</span> · S/ {money(offer.promo_price)} · {offer.starts_on}–{offer.ends_on}</p><p className="mt-1 text-xs text-amber-200">{status}</p></div><button type="button" onClick={()=>editOffer(offer)} className={btnGhost}>Editar oferta</button></div></article>;
  })}</section>}
  <form onSubmit={save} className={`${card} space-y-4`}>
   <h3 className="font-semibold">{editing?'Editar promoción':'Nueva promoción'}</h3>
   <label className="block text-sm">Servicio publicado<select required disabled={Boolean(editing)} value={form.serviceId} onChange={event=>setForm(current=>({...current,serviceId:event.target.value,promoPrice:''}))} className={`${inputClass} mt-1`}><option value="">Selecciona un servicio</option>{services.map(service=><option key={service.id} value={service.id}>{service.nombre} · S/ {money(service.precio)}</option>)}{editing&&!services.some(service=>String(service.id)===String(form.serviceId))&&<option value={form.serviceId} disabled>Servicio no publicado</option>}</select></label>
   {selected&&<p className="text-sm text-neutral-300">Precio habitual actual: S/ {money(selected.precio)}</p>}
   <div className="grid gap-3 sm:grid-cols-3">
    <label className="block text-sm">Precio promocional (S/)<input required type="number" min="0.01" max={selected?Math.max(.01,Number(selected.precio)-.01):undefined} step="0.01" value={form.promoPrice} onChange={event=>setForm(current=>({...current,promoPrice:event.target.value}))} className={`${inputClass} mt-1`} /></label>
    <label className="block text-sm">Día semanal desde<input required type="date" min={limaToday()} value={form.startsOn} onChange={event=>setForm(current=>({...current,startsOn:event.target.value,endsOn:current.endsOn<event.target.value?event.target.value:current.endsOn}))} className={`${inputClass} mt-1`} /></label>
    <label className="block text-sm">Hasta<input required type="date" min={form.startsOn||limaToday()} value={form.endsOn} onChange={event=>setForm(current=>({...current,endsOn:event.target.value}))} className={`${inputClass} mt-1`} /></label>
   </div>
   <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={form.active} onChange={event=>setForm(current=>({...current,active:event.target.checked}))} className="size-5 accent-amber-400"/>Publicar esta promoción</label>
   <p className="text-xs text-neutral-400">La oferta solo aparece ese día semanal, mientras el servicio siga publicado y el precio promocional sea menor al habitual. El servidor impide un segundo día promocional para este negocio en la misma semana. Una cita queda sujeta a aceptación; no se realizan cobros.</p>
   {offers.length===0&&services.length===0&&<p className="text-sm text-neutral-400">Publica primero un servicio con precio y duración definidos.</p>}
   <div className="flex flex-wrap gap-2"><button type="submit" disabled={busy||(!services.some(service=>String(service.id)===String(form.serviceId))&&!pausingHiddenOffer)} className={btnPrimary}>{busy?'Guardando…':'Guardar promoción'}</button>{editing&&<button type="button" onClick={newOffer} className={btnGhost}>Cancelar edición</button>}</div>
  </form>
 </section>;
}
