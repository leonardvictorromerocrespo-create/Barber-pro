import {lazy,Suspense} from 'react';
const LocationPicker=lazy(()=>import('./management/LocationPicker'));
export default function ShopRegistration({profile,loading,form,setForm,busy,error,onSubmit,onGoogle,onLogin,onManage}){
 if(loading)return <p role="status">Comprobando tu cuenta…</p>;
 if(!profile)return <div className="space-y-3"><p>Inicia sesión para registrar tu barbería. Tu cuenta no necesita permisos administrativos.</p><button onClick={onGoogle} className="w-full rounded-xl border border-white/20 p-3">Continuar con Google</button><button onClick={onLogin} className="w-full rounded-xl border border-white/20 p-3">Usar correo y contraseña</button>{error&&<p role="alert" className="text-red-300">{error}</p>}</div>;
 if(profile.rol!=='cliente')return <div><p>{profile.rol==='barbero'?'Tu cuenta ya tiene una barbería asignada. Consulta su estado y completa su perfil.':'Usa tu cuenta de propietario para registrar una barbería.'}</p>{profile.rol==='barbero'&&<button onClick={onManage} className="mt-3 rounded-xl bg-amber-400 px-4 py-2 font-bold text-black">Ver mi barbería</button>}</div>;
 return <form onSubmit={e=>{e.preventDefault();onSubmit();}} className="space-y-3">
  <p className="text-sm text-neutral-400">Completa tu local. La publicación requiere revisión y aprobación de Administración.</p>
  {[['nombre','Nombre de barbería'],['distrito','Distrito'],['whatsapp','WhatsApp'],['correo','Correo'],['direccion','Dirección del local']].map(([key,label])=><label key={key} className="block text-sm">{label}<input aria-label={label} required={['nombre','distrito','direccion'].includes(key)} type={key==='correo'?'email':key==='whatsapp'?'tel':'text'} value={form[key]||''} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 outline-none"/></label>)}
  <label className="block text-sm">Presentación<textarea aria-label="Presentación de la barbería" value={form.descripcion||''} onChange={e=>setForm(p=>({...p,descripcion:e.target.value}))} className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3"/></label>
  <Suspense fallback={<p>Cargando mapa…</p>}><LocationPicker lat={form.lat} lng={form.lng} onChange={({lat,lng})=>setForm(p=>({...p,lat,lng}))}/></Suspense>
  {error&&<p role="alert" className="text-red-300">{error}</p>}
  <button disabled={busy} className="w-full rounded-xl bg-white py-3 font-bold text-black disabled:opacity-40">{busy?'Registrando…':'Registrar barbería'}</button>
 </form>;
}
