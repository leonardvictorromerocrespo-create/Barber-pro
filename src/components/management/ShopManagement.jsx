import {useCallback,useEffect,useState} from 'react';
import {supabase} from '../../lib/supabase';
import {savedOperation} from '../../lib/operations';
import Services from './Services';
import Hours from './Hours';
import {Campo,Mensaje,btnPrimary,btnGhost,card,inputClass} from './ui';

function Profile({shop,onSaved}){
  const [form,setForm]=useState({nombre:shop.nombre??'',distrito:shop.distrito??'',direccion:shop.direccion??'',descripcion:shop.descripcion??'',whatsapp:shop.whatsapp??'',correo_contacto:shop.correo_contacto??'',lat:shop.lat??'',lng:shop.lng??'',disponible_ahora:shop.disponible_ahora});
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  async function save(e){e.preventDefault();if(busy)return;setBusy(true);setMessage('');setError('');try{
    const row={...form,lat:form.lat===''?null:Number(form.lat),lng:form.lng===''?null:Number(form.lng)};
    if(!row.nombre.trim()||!row.distrito.trim()||!row.direccion.trim())throw Error('Completa nombre, distrito y dirección');
    await savedOperation(()=>supabase.from('barberias').update(row).eq('id',shop.id).select('id').single());setMessage('Perfil guardado.');await onSaved();
  }catch(e){setError(e.message);}finally{setBusy(false);}}
  return <form onSubmit={save} className={`${card} space-y-4`}><h2 className="text-xl font-bold">Perfil de la barbería</h2>{['nombre','distrito','direccion','descripcion','whatsapp','correo_contacto','lat','lng'].map(key=><Campo key={key} id={`shop-${key}`} label={key.replaceAll('_',' ')}><input className={inputClass} id={`shop-${key}`} type={key==='correo_contacto'?'email':['lat','lng'].includes(key)?'number':'text'} step={['lat','lng'].includes(key)?'any':undefined} value={form[key]} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}/></Campo>)}<label className="flex gap-3"><input type="checkbox" checked={form.disponible_ahora} onChange={e=>setForm(p=>({...p,disponible_ahora:e.target.checked}))}/>Recibir solicitudes</label><p className="text-sm text-neutral-400">Aceptación siempre manual. Estado: {shop.estado}. Activación sujeta a revisión del administrador.</p><Mensaje>{error}</Mensaje><Mensaje tipo="ok">{message}</Mensaje><button disabled={busy} className={btnPrimary}>{busy?'Guardando…':'Guardar perfil'}</button></form>;
}
export default function ShopManagement({api,profile,onLogin,onBack,onRegister}){
  const [shop,setShop]=useState(null),[error,setError]=useState(''),[tab,setTab]=useState('perfil');
  const load=useCallback(async()=>{try{setShop(await api.ownerShop());setError('');}catch(e){setShop(null);setError(e.message);}},[api]);
  useEffect(()=>{let active=true;if(profile?.rol==='barbero')api.ownerShop().then(row=>{if(active){setShop(row);setError('');}}).catch(e=>{if(active){setShop(null);setError(e.message);}});return()=>{active=false;};},[profile,api]);
  return <main className="min-h-screen bg-neutral-950 p-6 text-white"><div className="mx-auto max-w-5xl space-y-5"><h1 className="text-3xl font-black">Mi barbería <span className="text-amber-400">MERYO</span></h1><button className={btnGhost} onClick={onBack}>Volver</button>
    {profile?.rol!=='barbero'?<div className={card}><p>Necesitas una cuenta de barbero real asignada a su barbería. Registra primero tu cuenta y solicita el registro del local.</p><div className="mt-3 flex flex-wrap gap-3">{!profile&&<button className={btnPrimary} onClick={onLogin}>Iniciar sesión</button>}{(!profile||profile.rol==='cliente')&&<button className={btnGhost} onClick={onRegister}>Registrar mi barbería</button>}</div></div>:<><div className="flex gap-2">{['perfil','servicios','horarios'].map(value=><button className={tab===value?btnPrimary:btnGhost} key={value} onClick={()=>setTab(value)}>{value}</button>)}</div><Mensaje>{error}</Mensaje>{shop&&(tab==='perfil'?<Profile key={shop.id} shop={shop} onSaved={load}/>:tab==='servicios'?<Services shop={shop} onCambio={load}/>:<Hours shop={shop}/>)}</>}
  </div></main>;
}
