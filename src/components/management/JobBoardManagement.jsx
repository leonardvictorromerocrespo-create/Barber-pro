import {useCallback,useEffect,useState} from 'react';
import {btnGhost,btnPrimary,card,inputClass,Mensaje,Vacio} from './ui';

function dateInput(value){return value?String(value).slice(0,10):'';}
function defaultExpiry(){const date=new Date();date.setDate(date.getDate()+30);return date.toISOString().slice(0,10);}
const emptyForm=()=>({puesto:'',distrito:'',horario:'',descripcion:'',vence_el:defaultExpiry()});

export default function JobBoardManagement({api,shop}){
  const [rows,setRows]=useState([]);
  const [form,setForm]=useState(emptyForm);
  const [editingId,setEditingId]=useState(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{const data=await api.ownerJobListings();setRows(Array.isArray(data)?data:[]);}
    catch(e){setError(e.message||'No se pudieron cargar tus vacantes.');}
    finally{setLoading(false);}
  },[api]);
  useEffect(()=>{void load();},[load]);
  function edit(row){
    setEditingId(row.id);
    setForm({puesto:row.puesto||'',distrito:row.distrito||shop?.distrito||'',horario:row.horario||'',descripcion:row.descripcion||'',vence_el:dateInput(row.vence_el)||defaultExpiry()});
    setError('');setNotice('');
  }
  function reset(){setEditingId(null);setForm({...emptyForm(),distrito:shop?.distrito||''});}
  async function save(published){
    if(busy)return;
    setBusy(true);setError('');setNotice('');
    try{
      await api.saveJobListing({...form,id:editingId,publicada:published});
      await load();
      reset();
      setNotice(published?'Vacante publicada. Ya aparece en la bolsa pública.':'Borrador guardado. Puedes publicarlo cuando esté listo.');
    }catch(e){setError(e.message||'No se pudo guardar la vacante.');}
    finally{setBusy(false);}
  }
  async function unpublish(row){
    setBusy(true);setError('');setNotice('');
    try{await api.saveJobListing({...row,vence_el:dateInput(row.vence_el),publicada:false});await load();setNotice('Vacante retirada de la bolsa pública.');}
    catch(e){setError(e.message||'No se pudo retirar la vacante.');}
    finally{setBusy(false);}
  }
  return <section className="space-y-5">
    <div className={card}><h2 className="text-xl font-bold">Bolsa de trabajo</h2><p className="mt-2 text-sm text-neutral-400">Publica vacantes para que cualquier visitante de MERYO pueda verlas. Las personas interesadas te contactarán al WhatsApp de tu barbería.</p></div>
    <form className={card+' space-y-4'} onSubmit={e=>{e.preventDefault();void save(true);}}>
      <h3 className="text-lg font-bold">{editingId?'Editar vacante':'Crear vacante'}</h3>
      <label className="block text-sm text-neutral-300">Puesto<input required minLength={3} maxLength={80} className={inputClass+' mt-1'} value={form.puesto} onChange={e=>setForm(v=>({...v,puesto:e.target.value}))} placeholder="Ej.: Barbero con experiencia"/></label>
      <label className="block text-sm text-neutral-300">Distrito<input required minLength={2} maxLength={80} className={inputClass+' mt-1'} value={form.distrito} onChange={e=>setForm(v=>({...v,distrito:e.target.value}))} placeholder="Distrito"/></label>
      <label className="block text-sm text-neutral-300">Horario ofrecido<input required minLength={2} maxLength={120} className={inputClass+' mt-1'} value={form.horario} onChange={e=>setForm(v=>({...v,horario:e.target.value}))} placeholder="Ej.: Tiempo completo, lunes a sábado"/></label>
      <label className="block text-sm text-neutral-300">Detalles<textarea maxLength={700} rows={4} className={inputClass+' mt-1'} value={form.descripcion} onChange={e=>setForm(v=>({...v,descripcion:e.target.value}))} placeholder="Experiencia, requisitos y condiciones del puesto"/></label>
      <label className="block max-w-xs text-sm text-neutral-300">Publicar hasta<input type="date" required min={new Date(Date.now()+86400000).toISOString().slice(0,10)} max={new Date(Date.now()+90*86400000).toISOString().slice(0,10)} className={inputClass+' mt-1'} value={form.vence_el} onChange={e=>setForm(v=>({...v,vence_el:e.target.value}))}/></label>
      {error&&<Mensaje>{error}</Mensaje>}{notice&&<Mensaje tipo="ok">{notice}</Mensaje>}
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={busy} className={btnPrimary}>{busy?'Guardando…':editingId?'Guardar y publicar':'Publicar vacante'}</button><button type="button" disabled={busy} className={btnGhost} onClick={()=>void save(false)}>Guardar borrador</button>{editingId&&<button type="button" disabled={busy} className={btnGhost} onClick={reset}>Cancelar edición</button>}</div>
    </form>
    <div className={card+' space-y-4'}><div><h3 className="text-lg font-bold">Tus anuncios</h3><p className="text-sm text-neutral-400">Los anuncios vencidos dejan de mostrarse automáticamente.</p></div>
      {loading?<p role="status" className="text-sm text-neutral-400">Cargando anuncios…</p>:rows.length===0?<Vacio titulo="Todavía no publicaste vacantes">Crea un anuncio para que aparezca en la bolsa pública.</Vacio>:<div className="space-y-3">{rows.map(row=><article key={row.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-bold">{row.puesto}</h4><p className="mt-1 text-sm text-neutral-400">{row.distrito} · {row.horario}</p><p className="mt-1 text-xs text-neutral-500">{row.publicada?'Publicada':'Borrador'} · vence {dateInput(row.vence_el)}</p></div><div className="flex flex-wrap gap-2"><button type="button" className={btnGhost} disabled={busy} onClick={()=>edit(row)}>Editar</button>{row.publicada&&<button type="button" className={btnGhost} disabled={busy} onClick={()=>void unpublish(row)}>Retirar</button>}</div></div>
      </article>)}</div>}
    </div>
  </section>;
}
