import {useCallback,useEffect,useMemo,useState} from 'react';
import {btnPrimary,btnGhost,card,inputClass,Mensaje} from './ui';
import './InspirationManager.css';

const options={
 barberia:[['corte','Corte'],['barba','Barba'],['coloracion','Coloración'],['peinados','Peinados'],['tratamientos_capilares','Tratamientos capilares']],
 belleza:[['corte','Corte'],['coloracion','Coloración'],['peinados','Peinados'],['tratamientos_capilares','Tratamientos capilares'],['manicure','Manicure'],['pedicure','Pedicure'],['depilacion','Depilación']],
};
export default function InspirationManager({api,shop,assets=[],team,services=[]}){
 const categories=(shop.tipos_negocio||['barberia']).filter(value=>['barberia','belleza'].includes(value));
 const photos=useMemo(()=>assets.filter(asset=>asset.kind==='foto'&&asset.title!=='[meryo-profile-photo]'&&asset.active!==false&&asset.url),[assets]);
 const [records,setRecords]=useState([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [selectedRecord,setSelectedRecord]=useState(null),[assetId,setAssetId]=useState('');
 const [catalogCategory,setCatalogCategory]=useState(categories.length===1?categories[0]:'');
 const [workCategory,setWorkCategory]=useState(''),[title,setTitle]=useState(''),[description,setDescription]=useState('');
 const [memberId,setMemberId]=useState(''),[serviceId,setServiceId]=useState(''),[published,setPublished]=useState(false);
 const [error,setError]=useState(''),[ok,setOk]=useState('');
 const load=useCallback(async()=>{setLoading(true);setError('');try{setRecords(await api.ownerInspirations());}catch(e){setError(e.message||'No se pudieron cargar las publicaciones.');}finally{setLoading(false);}},[api]);
 useEffect(()=>{void load();},[load,assets]);
 const activeOptions=options[catalogCategory]||[];
 const beginEdit=record=>{setSelectedRecord(record);setAssetId(record.asset_id||'');setCatalogCategory(record.catalog_category||'');setWorkCategory(record.work_category||'');setTitle(record.title||'');setDescription(record.description||'');setMemberId(record.member_id||'');setServiceId(record.service_id?String(record.service_id):'');setPublished(record.published===true);setError('');setOk('');};
 const reset=()=>{setSelectedRecord(null);setAssetId('');setCatalogCategory(categories.length===1?categories[0]:'');setWorkCategory('');setTitle('');setDescription('');setMemberId('');setServiceId('');setPublished(false);setError('');};
 async function save(event){event.preventDefault();if(busy)return;setBusy(true);setError('');setOk('');try{await api.saveInspiration({id:selectedRecord?.id||null,assetId,catalogCategory,workCategory,title,description,memberId:memberId||null,serviceId:serviceId||null,published});await load();setOk(published?'Trabajo guardado en Inspiración. Solo se muestra si el negocio está aprobado y publicado.':'Trabajo guardado fuera de Inspiración.');setSelectedRecord(null);setAssetId('');setTitle('');setDescription('');setWorkCategory('');setMemberId('');setServiceId('');setPublished(false);if(categories.length>1)setCatalogCategory('');}catch(e){setError(e.message||'No se pudo guardar la publicación.');}finally{setBusy(false);}}
 async function retire(record){if(busy)return;setBusy(true);setError('');setOk('');try{await api.saveInspiration({id:record.id,assetId:record.asset_id,catalogCategory:record.catalog_category,workCategory:record.work_category,title:record.title,description:record.description,memberId:record.member_id,serviceId:record.service_id,published:false});await load();setOk('Trabajo retirado de Inspiración. La foto original y cualquier solicitud anterior se conservan.');if(selectedRecord?.id===record.id)reset();}catch(e){setError(e.message||'No se pudo retirar el trabajo.');}finally{setBusy(false);}}
 const assetById=new Map(assets.map(asset=>[asset.id,asset]));
 return <section className="space-y-5" aria-labelledby="meryo-inspiration-owner-title">
  <form onSubmit={save} className={`${card} space-y-4`}>
   <div><h2 id="meryo-inspiration-owner-title" className="text-xl font-bold">Inspiración: publica un trabajo</h2><p className="mt-1 text-sm text-neutral-400">Elige una foto ya guardada en el portafolio. No se duplican archivos y las fotos anteriores no aparecen hasta que completes y publiques su información.</p></div>
   <label className="block">Fotografía del portafolio<select required aria-label="Fotografía para Inspiración" className={inputClass} value={assetId} onChange={e=>setAssetId(e.target.value)}><option value="">Elige una foto activa</option>{photos.map(asset=><option key={asset.id} value={asset.id}>{asset.title||'Foto de portafolio'} · {new Date(asset.created_at).toLocaleDateString('es-PE')}</option>)}</select></label>
   {!photos.length&&<p role="status" className="text-sm text-neutral-400">Primero sube una fotografía desde el formulario de contenido existente.</p>}
   {assetById.get(assetId)?.url&&<img className="meryo-inspiration-owner-preview" src={assetById.get(assetId).url} alt="Vista previa del trabajo seleccionado" loading="lazy"/>}
   <div className="grid gap-3 sm:grid-cols-2">
    <label className="block">Catálogo<select required aria-label="Catálogo para este trabajo" className={inputClass} value={catalogCategory} onChange={e=>{setCatalogCategory(e.target.value);setWorkCategory('');}}><option value="">Elige Barberías o Belleza</option>{categories.map(value=><option key={value} value={value}>{value==='belleza'?'Peluquerías y belleza':'Barberías'}</option>)}</select></label>
    <label className="block">Categoría del trabajo<select required aria-label="Categoría del trabajo" className={inputClass} value={workCategory} onChange={e=>setWorkCategory(e.target.value)}><option value="">Elige una categoría</option>{activeOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label className="block">Título<input required minLength={2} maxLength={80} className={inputClass} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ej.: Corte en capas"/></label>
    <label className="block">Profesional que realizó el trabajo<select aria-label="Profesional del trabajo" className={inputClass} value={memberId} onChange={e=>setMemberId(e.target.value)}><option value="">Sin identificar</option>{(team?.members||[]).map(member=><option key={member.id} value={member.id}>{member.display_name}{member.active?'':' · inactivo'}</option>)}</select></label>
    <label className="block sm:col-span-2">Descripción breve<textarea maxLength={500} rows={3} className={inputClass} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe el estilo y sus detalles principales."/></label>
    <label className="block">Servicio asociado (opcional)<select aria-label="Servicio asociado al trabajo" className={inputClass} value={serviceId} onChange={e=>setServiceId(e.target.value)}><option value="">Sin servicio asociado</option>{services.map(service=><option key={service.id} value={service.id}>{service.nombre}{!service.activo?' · inactivo':''}{service.requiere_evaluacion?' · requiere evaluación':''}</option>)}</select></label>
   </div>
   <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)}/>Mostrar en Inspiración</label>
   <p className="text-xs leading-relaxed text-neutral-400">Publica únicamente trabajos propios y asegúrate de contar con autorización para mostrar a personas identificables. La disponibilidad para reservar depende de que el profesional y el servicio sigan activos y asignados.</p>
   {selectedRecord&&<button type="button" className={btnGhost} onClick={reset}>Cancelar edición</button>}
   <Mensaje>{error}</Mensaje><Mensaje tipo="ok">{ok}</Mensaje>
   <button disabled={busy||!photos.length||!assetId||!catalogCategory||!workCategory||title.trim().length<2} className={btnPrimary}>{busy?'Guardando…':selectedRecord?'Guardar cambios':'Guardar trabajo'}</button>
  </form>
  <section className={`${card} space-y-3`}><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-bold">Trabajos de este negocio</h3><button type="button" className={btnGhost} onClick={()=>void load()} disabled={loading}>Actualizar</button></div>
   {loading&&<p role="status" className="text-sm text-neutral-400">Cargando trabajos…</p>}{!loading&&!records.length&&<p className="text-sm text-neutral-400">Aún no has preparado publicaciones de Inspiración.</p>}
   <div className="grid gap-3 sm:grid-cols-2">{records.map(record=>{const asset=assetById.get(record.asset_id);return <article key={record.id} className="meryo-inspiration-owner-record">{asset?.url&&<img src={asset.url} alt={record.title} loading="lazy"/>}<div className="min-w-0"><h4>{record.title}</h4><p>{record.catalog_category==='belleza'?'Belleza':'Barberías'} · {record.work_category.replaceAll('_',' ')} · {record.published?'Visible':'Oculto'}</p><p className="truncate">{record.description||'Sin descripción'}</p></div><div className="flex flex-wrap gap-2"><button type="button" className={btnGhost} onClick={()=>beginEdit(record)}>Editar</button>{record.published&&<button type="button" className={btnGhost} disabled={busy} onClick={()=>void retire(record)}>Retirar</button>}</div></article>;})}</div>
  </section>
 </section>;
}
