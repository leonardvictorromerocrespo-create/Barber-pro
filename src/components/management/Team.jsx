import {useEffect,useMemo,useState} from 'react';
import {isTeamPhotoAsset,teamPhotoMemberId,teamPhotoTitle,validateContent} from '../../lib/shop-content';
import {btnPrimary,btnGhost,card,inputClass,Mensaje} from './ui';

function PhotoUpload({api,shopId,memberId,photoUrl,uploadsEnabled,uploadsReason,onUploaded}){
 const [file,setFile]=useState(null),[preview,setPreview]=useState(''),[error,setError]=useState(''),[ok,setOk]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
  if(!file){setPreview('');return;}
  const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);
 },[file]);
 function select(event){
  setError('');setOk('');const chosen=event.target.files?.[0];
  if(!chosen){setFile(null);return;}
  try{validateContent(chosen,'foto');setFile(chosen);}catch(issue){setFile(null);setError(issue.message);event.target.value='';}
 }
 async function upload(){
  if(!file||busy||!uploadsEnabled)return;
  setBusy(true);setError('');setOk('');
  try{await api.uploadTeamPhoto(shopId,memberId,file);setFile(null);setOk('Foto guardada. Se mostrará en el perfil público del negocio.');await onUploaded();}
  catch(issue){setError(issue.message||'No se pudo guardar la foto.');}
  finally{setBusy(false);}
 }
 return <div className="meryo-team-photo-upload">
  <div className="meryo-team-photo-current" aria-label={photoUrl?'Foto actual del profesional':'Sin foto publicada'}>
   {preview||photoUrl?<img src={preview||photoUrl} alt={preview?'Vista previa de la nueva foto':'Foto actual del profesional'} className="meryo-team-photo-current__image"/>:<span aria-hidden="true">＋</span>}
  </div>
  <div className="meryo-team-photo-fields">
   <label className="block text-sm font-medium">Tu foto de perfil
    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={select} className="mt-2 block w-full text-xs" aria-label="Elegir foto de perfil profesional" disabled={!uploadsEnabled||busy}/>
   </label>
   <p className="text-xs text-neutral-400">JPG, PNG o WebP · máximo 5 MB. Solo podrás cambiar tu propia foto.</p>
   {!uploadsEnabled&&<p role="status" className="text-xs text-neutral-400">{uploadsReason||'Las subidas siguen desactivadas por el servidor.'}</p>}
   {preview&&<button type="button" onClick={()=>setFile(null)} className={btnGhost}>Cancelar selección</button>}
   <Mensaje>{error}</Mensaje><Mensaje tipo="ok">{ok}</Mensaje>
   <button type="button" disabled={!file||busy||!uploadsEnabled} onClick={()=>void upload()} className={btnPrimary}>{busy?'Guardando…':photoUrl?'Actualizar foto':'Guardar foto'}</button>
  </div>
 </div>;
}

function Member({member,services,api,shopId,onSaved,editable,isSelf,photoUrl,uploadsEnabled,uploadsReason}){
 const [form,setForm]=useState(member),[chosen,setChosen]=useState((member.services??[]).map(String)),[error,setError]=useState(''),[ok,setOk]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{setForm(member);setChosen((member.services??[]).map(String));},[member]);
 async function save(event){
  event.preventDefault();if(busy)return;setBusy(true);setError('');setOk('');
  try{await api.saveMember(form,chosen);await onSaved();setOk('Integrante y servicios guardados.');}
  catch(issue){setError(issue.message);}
  finally{setBusy(false);}
 }
 const memberInitials=String(member.display_name||'?').trim().split(/\s+/).slice(0,2).map(part=>Array.from(part)[0]||'').join('').toLocaleUpperCase('es');
 return <article className="meryo-team-management-card">
  <div className="meryo-team-management-heading">
   <div className="meryo-team-management-avatar">{photoUrl?<img src={photoUrl} alt={`Foto de ${member.display_name}`} loading="lazy"/>:memberInitials}</div>
   <div className="min-w-0">{member.propietario&&<p className="meryo-profile-owner-label">Propietario</p>}<h3>{member.display_name}</h3>{editable&&<p>{member.email}</p>}</div>
  </div>
  {isSelf&&<PhotoUpload api={api} shopId={shopId} memberId={member.id} photoUrl={photoUrl} uploadsEnabled={uploadsEnabled} uploadsReason={uploadsReason} onUploaded={onSaved}/>}
  {editable&&<form onSubmit={save} className="meryo-team-management-form">
   <label className="block">Nombre profesional<input aria-label={`Nombre de ${member.display_name}`} className={inputClass} required minLength={2} maxLength={80} value={form.display_name} onChange={event=>setForm(previous=>({...previous,display_name:event.target.value}))}/></label>
   <label className="flex gap-2"><input type="checkbox" disabled={member.propietario} checked={form.active} onChange={event=>setForm(previous=>({...previous,active:event.target.checked}))}/>Acceso activo al equipo</label>
   <fieldset className="space-y-2"><legend className="mb-2 font-bold">Servicios que realiza</legend>{services.map(service=><label className="flex gap-2" key={service.id}><input type="checkbox" checked={chosen.includes(String(service.id))} onChange={event=>setChosen(previous=>event.target.checked?[...previous,String(service.id)]:previous.filter(id=>id!==String(service.id)))}/>{service.nombre}{!service.activo?' · inactivo':''}</label>)}</fieldset>
   <Mensaje>{error}</Mensaje><Mensaje tipo="ok">{ok}</Mensaje><button disabled={busy} className={btnPrimary}>{busy?'Guardando…':'Guardar integrante'}</button>
   <p className="text-xs text-neutral-400">Desactivar conserva el historial. Primero deben resolverse sus citas vigentes; la aplicación no las cancela ni reasigna por su cuenta.</p>
  </form>}
 </article>;
}

export default function Team({api,team,shop,profile,services,onSaved}){
 const [email,setEmail]=useState(''),[name,setName]=useState(''),[link,setLink]=useState(''),[error,setError]=useState(''),[ok,setOk]=useState(''),[busy,setBusy]=useState(false);
 const [assets,setAssets]=useState([]),[uploadConfig,setUploadConfig]=useState(null),[assetError,setAssetError]=useState('');
 useEffect(()=>{
  let active=true;
  api.shopAssets(shop.id).then(rows=>{if(active){setAssets(rows);setAssetError('');}}).catch(issue=>{if(active)setAssetError(issue.message||'No se pudieron consultar las fotos del equipo.');});
  api.contentConfig().then(config=>{if(active)setUploadConfig(config);}).catch(issue=>{if(active)setUploadConfig({uploads_enabled:false,reason:issue.message||'No se pudo verificar si Storage permite nuevas subidas.'});});
  return()=>{active=false;};
 },[api,shop.id]);
 const photosByMember=useMemo(()=>{
  const map=new Map();
  for(const asset of assets){const memberId=teamPhotoMemberId(asset.title);if(asset.kind==='foto'&&asset.url&&memberId&&isTeamPhotoAsset(asset,shop.id,memberId))map.set(asset.title,asset.url);}
  return map;
 },[assets,shop.id]);
 const reloadPhotos=async()=>{
  try{setAssets(await api.shopAssets(shop.id));setAssetError('');}
  catch(issue){setAssetError(issue.message||'La foto se guardó, pero no pudimos actualizar la vista.');}
  await onSaved();
 };
 async function invite(event){event.preventDefault();setBusy(true);setError('');setLink('');setOk('');try{const result=await api.inviteMember(email,name);setLink(window.location.origin+'/#team-invite/'+result.token);await onSaved();setEmail('');setName('');}catch(issue){setError(issue.message);}finally{setBusy(false);}}
 async function revoke(id){setBusy(true);setError('');setOk('');try{await api.revokeInvite(id);await onSaved();setOk('Invitación revocada.');}catch(issue){setError(issue.message);}finally{setBusy(false);}}
 const owner=team.owner===true,uploadsEnabled=uploadConfig?.uploads_enabled===true;
 return <section className="meryo-team-management space-y-5">
  {!owner&&<p className="text-sm text-neutral-400">Este espacio muestra tu propio perfil de equipo. La foto solo se puede cambiar desde tu cuenta.</p>}
  {owner&&<form onSubmit={invite} className={`${card} space-y-4`}>
   <h2 className="text-xl font-bold">Invitar integrante</h2><p className="text-sm text-neutral-400">El integrante entra con su propia cuenta y acepta el enlace. No se envía correo automático: copia y compártelo personalmente con ese correo.</p>
   <label className="block">Correo invitado<input aria-label="Correo invitado" required type="email" className={inputClass} value={email} onChange={event=>setEmail(event.target.value)}/></label>
   <label className="block">Nombre profesional<input aria-label="Nombre del integrante" required minLength={2} maxLength={80} className={inputClass} value={name} onChange={event=>setName(event.target.value)}/></label>
   <button disabled={busy} className={btnPrimary}>Crear invitación</button>
   {link&&<div className="space-y-2"><p className="text-sm text-amber-300">Enlace creado; caduca en 7 días. No se podrá recuperar después de cerrar esta pantalla. No lo publiques.</p><input aria-label="Enlace de invitación" readOnly className={inputClass} value={link}/><button type="button" className={btnGhost} onClick={async()=>{try{await navigator.clipboard.writeText(link);setOk('Enlace copiado.');}catch{setError('Copia el enlace del campo de invitación.');}}}>Copiar enlace</button></div>}
   <Mensaje>{error}</Mensaje><Mensaje tipo="ok">{ok}</Mensaje>
  </form>}
  {assetError&&<p role="alert" className="text-sm text-red-300">{assetError}</p>}
  <div className="meryo-team-management-list">{team.members.map(member=><Member key={member.id} member={member} services={services} api={api} shopId={shop.id} onSaved={reloadPhotos} editable={owner} isSelf={String(member.user_id)===String(profile?.id)} photoUrl={photosByMember.get(teamPhotoTitle(member.id))||''} uploadsEnabled={uploadsEnabled} uploadsReason={uploadConfig?.reason}/>)}</div>
  {owner&&<section className={card}><h3 className="font-bold">Invitaciones registradas</h3>{team.invites.map(invite=>{
   const label=new Date(invite.expires_at).toLocaleString('es-PE',{timeZone:'America/Lima'});
   return <div key={invite.id} className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3"><div><p className="break-all">{invite.email}</p><p className="text-sm text-neutral-400">{invite.display_name} · {invite.status} · vence {label}</p></div>{invite.status==='pendiente'&&<button disabled={busy} onClick={()=>void revoke(invite.id)} className={btnGhost}>Revocar invitación</button>}</div>;
  })}</section>}
 </section>;
}
