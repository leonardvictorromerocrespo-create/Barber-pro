import {lazy,Suspense,useCallback,useEffect,useState} from 'react';
import Content from './Content';
import ShopHistory from '../ShopHistory';
import Team from './Team';
import IndividualAgenda from './IndividualAgenda';
import Services from './Services';
import Hours from './Hours';
import {Campo,Mensaje,btnPrimary,btnGhost,card,inputClass} from './ui';
import {coordinates} from '../../lib/catalog';
const LocationPicker=lazy(()=>import('./LocationPicker'));

function Profile({api,shop,onSaved}){
  const [form,setForm]=useState({nombre:shop.nombre??'',distrito:shop.distrito??'',direccion:shop.direccion??'',descripcion:shop.descripcion??'',whatsapp:shop.whatsapp??'',correo_contacto:shop.correo_contacto??'',lat:shop.lat??'',lng:shop.lng??'',disponible_ahora:shop.disponible_ahora});
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const [locationConfirmed,setLocationConfirmed]=useState(()=>Boolean(coordinates(shop)));
  async function save(e){e.preventDefault();if(busy)return;setBusy(true);setMessage('');setError('');try{
    const row={...form,lat:form.lat===''?null:Number(form.lat),lng:form.lng===''?null:Number(form.lng)};
    if(!row.nombre.trim()||!row.distrito.trim()||!row.direccion.trim())throw Error('Completa nombre, distrito y dirección');
    if(!locationConfirmed||!coordinates(row))throw Error('Selecciona o confirma la ubicación del local en el mapa.');
    await api.saveShop(row);await onSaved();setMessage('Perfil guardado. Los cambios de nombre, dirección o ubicación requieren una nueva aprobación si estaba activa.');
  }catch(e){setError(e.message);}finally{setBusy(false);}}
  return <form onSubmit={save} className={`${card} space-y-4`}><h2 className="text-xl font-bold">Perfil de la barbería</h2>{['nombre','distrito','direccion','descripcion','whatsapp','correo_contacto'].map(key=><Campo key={key} id={`shop-${key}`} label={key.replaceAll('_',' ')}><input className={inputClass} id={`shop-${key}`} type={key==='correo_contacto'?'email':['lat','lng'].includes(key)?'number':'text'} step={['lat','lng'].includes(key)?'any':undefined} value={form[key]} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}/></Campo>)}<Suspense fallback={<p>Cargando mapa…</p>}><LocationPicker lat={form.lat} lng={form.lng} savedLocation={Boolean(coordinates(shop))} onReady={setLocationConfirmed} onChange={({lat,lng})=>setForm(p=>({...p,lat,lng}))}/></Suspense><label className="flex gap-3"><input type="checkbox" checked={form.disponible_ahora} onChange={e=>setForm(p=>({...p,disponible_ahora:e.target.checked}))}/>Recibir solicitudes</label><p className="text-sm text-neutral-400">Aceptación siempre manual. Estado: {shop.estado}. Activación sujeta a revisión del administrador.</p><Mensaje>{error}</Mensaje><Mensaje tipo="ok">{message}</Mensaje><button disabled={busy||!locationConfirmed} className={btnPrimary}>{busy?'Guardando…':'Guardar perfil'}</button></form>;
}
export default function ShopManagement({api,profile,onLogin,onBack,onRegister}){
 const [shop,setShop]=useState(null),[context,setContext]=useState(null),[services,setServices]=useState([]),[error,setError]=useState(''),[tab,setTab]=useState(()=>{const value=typeof window==='undefined'?null:new URLSearchParams(window.location.search).get('shop_view');return ['contenido','servicios','horarios','historial','equipo','agenda'].includes(value)?value:'perfil';});
 const load=useCallback(async()=>{try{const team=await api.team(),row=await api.ownerShop(),list=team.owner?await api.ownerServices():[];setContext(team);setShop(row);setServices(list);setError('');}catch(e){setContext(null);setShop(null);setError(e.message);}},[api]);
 useEffect(()=>{if(profile?.rol==='barbero')load();},[profile,load]);
 const isOwner=context?.owner===true,effectiveTab=isOwner?tab:'agenda';
 function changeTab(value){setTab(value);const url=new URL(window.location.href);url.searchParams.set('shop_view',value);window.history.replaceState(null,'',url.pathname+url.search+url.hash);}
 const labels={perfil:'Perfil',contenido:'Fotos y video',servicios:'Servicios',horarios:'Horario general',equipo:'Equipo',agenda:'Agenda individual',historial:'Historial'};
 return <main className="min-h-screen bg-neutral-950 p-6 text-white"><div className="mx-auto max-w-5xl space-y-5"><h1 className="text-3xl font-black">Mi barbería <span className="text-amber-400">MERYO</span></h1><button className={btnGhost} onClick={onBack}>Volver</button>
 {profile?.rol!=='barbero'?<div className={card}><p>Necesitas una cuenta de barbero real asignada a su barbería. Registra primero tu cuenta y solicita el registro del local.</p><div className="mt-3 flex flex-wrap gap-3">{!profile&&<button className={btnPrimary} onClick={onLogin}>Iniciar sesión</button>}{(!profile||profile.rol==='cliente')&&<button className={btnGhost} onClick={onRegister}>Registrar mi barbería</button>}</div></div>:<><Mensaje>{error}</Mensaje>{!context&&!error&&<p role="status">Consultando tu equipo…</p>}{context&&shop&&<><div role="status" className="rounded-2xl border border-amber-400/30 p-4"><p className="font-bold text-amber-300">{shop.estado==='pendiente'?'Solicitud pendiente de aprobación':shop.estado==='activa'&&shop.verificada?'Barbería aprobada':`Estado de tu barbería: ${shop.estado}`}</p><p className="mt-2 text-sm">{shop.estado==='pendiente'?'Puedes completar perfil, servicios y horarios. Aparecerá en el catálogo cuando Administración la apruebe.':'Consulta y gestiona tu perfil con los permisos de tu cuenta.'}</p></div><p className="text-sm text-neutral-400">{isOwner?'Propietario · gestión de perfil y equipo':'Integrante · acceso limitado a tu agenda y citas autorizadas'}</p><nav aria-label="Mi barbería" className="flex flex-wrap gap-2">{(isOwner?['perfil','contenido','servicios','horarios','equipo','agenda','historial']:['agenda']).map(value=><button className={effectiveTab===value?btnPrimary:btnGhost} key={value} onClick={()=>changeTab(value)}>{labels[value]}</button>)}</nav>
 {effectiveTab==='agenda'?<IndividualAgenda api={api} team={context} profile={profile} onSaved={load} onSearch={onBack}/>:effectiveTab==='equipo'?<Team api={api} team={context} services={services} onSaved={load}/>:effectiveTab==='perfil'?<Profile key={shop.id} api={api} shop={shop} onSaved={load}/>:effectiveTab==='contenido'?<Content api={api} shop={shop}/>:effectiveTab==='historial'?<ShopHistory api={api} id={shop.id}/>:effectiveTab==='servicios'?<Services shop={shop} onCambio={load}/>:<Hours shop={shop}/>}
 </>}</>}
 </div></main>;
}
