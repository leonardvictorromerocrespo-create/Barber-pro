import {lazy,Suspense} from 'react';
const LocationPicker=lazy(()=>import('./management/LocationPicker'));

const businessNames={barberia:'barbería',belleza:'salón de belleza',ambos:'negocio mixto'};
export default function ShopRegistration({profile,loading,form,setForm,busy,error,onSubmit,onGoogle,onLogin,onManage}){
 if(loading)return <p role="status">Comprobando tu cuenta…</p>;
 if(!profile)return <div className="space-y-3"><p>Inicia sesión para registrar tu negocio. Tu cuenta no necesita permisos administrativos.</p><button onClick={onGoogle} className="w-full rounded-xl border border-white/20 p-3">Continuar con Google</button><button onClick={onLogin} className="w-full rounded-xl border border-white/20 p-3">Usar correo y contraseña</button>{error&&<p role="alert" className="text-red-300">{error}</p>}</div>;
 if(profile.rol!=='cliente')return <div><p>{profile.rol==='barbero'?'Tu cuenta ya tiene un negocio asignado. Consulta su estado y completa su perfil.':'Usa tu cuenta de propietario para registrar un negocio.'}</p>{profile.rol==='barbero'&&<button onClick={onManage} className="mt-3 rounded-xl bg-amber-400 px-4 py-2 font-bold text-black">Ver mi negocio</button>}</div>;
 const textField=(key,label,required=false,type='text')=><label key={key} className="block text-sm">{label}<input aria-label={label} required={required} type={type} value={form[key]||''} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 outline-none"/></label>;
 return <form onSubmit={e=>{e.preventDefault();onSubmit();}} className="space-y-3">
  <p className="text-sm text-neutral-400">Completa los datos del local. La publicación requiere revisión y aprobación de Administración.</p>
  <label className="block text-sm">Tipo de negocio<select aria-label="Tipo de negocio" value={form.tipo_negocio||'barberia'} onChange={e=>setForm(p=>({...p,tipo_negocio:e.target.value}))} className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3"><option value="barberia">Barbería</option><option value="belleza">Salón de belleza o peluquería</option><option value="ambos">Barbería y salón de belleza</option></select></label>
  {textField('nombre','Nombre del negocio',true)}{textField('distrito','Distrito',true)}{textField('whatsapp','WhatsApp',false,'tel')}{textField('correo','Correo',false,'email')}{textField('direccion','Dirección del local',true)}
  <label className="block text-sm">Presentación<textarea aria-label="Presentación del negocio" value={form.descripcion||''} onChange={e=>setForm(p=>({...p,descripcion:e.target.value}))} className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3"/></label>
  <Suspense fallback={<p>Cargando mapa…</p>}><LocationPicker lat={form.lat} lng={form.lng} onChange={({lat,lng})=>setForm(p=>({...p,lat,lng}))} onReady={locationConfirmed=>setForm(p=>({...p,locationConfirmed}))}/></Suspense>
  {error&&<p role="alert" className="text-red-300">{error}</p>}
  <button disabled={busy||form.locationConfirmed!==true} className="w-full rounded-xl bg-white py-3 font-bold text-black disabled:opacity-40">{busy?'Registrando…':`Registrar ${businessNames[form.tipo_negocio]||'negocio'}`}</button>
 </form>;
}
