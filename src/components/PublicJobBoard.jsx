import {useEffect,useMemo,useState} from 'react';
import MeryoLogo from './MeryoLogo';

function contactUrl(value){
  const digits=String(value||'').replace(/\D/g,'');
  const phone=digits.startsWith('51')?digits:digits.length===9?'51'+digits:digits;
  return phone?'https://wa.me/'+phone:null;
}

function dateLabel(value){
  const date=/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?new Date(value+'T12:00:00'):new Date(value);
  return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat('es-PE',{day:'numeric',month:'short',year:'numeric'}).format(date);
}

export default function PublicJobBoard({api,onBack}){
  const [jobs,setJobs]=useState([]);
  const [district,setDistrict]=useState('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    setLoading(true);setError('');
    api.publicJobListings().then(rows=>{if(active)setJobs(Array.isArray(rows)?rows:[]);})
      .catch(e=>{if(active)setError(e.message||'No se pudieron cargar las vacantes.');})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[api]);
  const districts=useMemo(()=>[...new Set(jobs.map(job=>job.distrito).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')), [jobs]);
  const visibleJobs=useMemo(()=>district?jobs.filter(job=>job.distrito?.toLocaleLowerCase('es')===district.toLocaleLowerCase('es')):jobs,[jobs,district]);
  return <main className="min-h-screen bg-neutral-950 px-4 py-5 pb-12 text-white sm:px-6">
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <MeryoLogo variant="dark" className="h-8 w-auto"/>
        <button type="button" onClick={onBack} className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10">Volver a MERYO</button>
      </header>
      <section className="rounded-3xl border border-amber-300/20 bg-gradient-to-br from-neutral-900 via-neutral-900 to-amber-950/40 p-6 sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[.22em] text-amber-300">MERYO · Oportunidades</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">Bolsa de trabajo</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-300">Vacantes publicadas por barberías. Revisa el puesto, el distrito y el horario; contacta directamente al negocio.</p>
      </section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-xl font-bold">Vacantes disponibles</h2><p className="mt-1 text-sm text-neutral-400">{visibleJobs.length} {visibleJobs.length===1?'oportunidad':'oportunidades'}</p></div>
        {districts.length>1&&<label className="grid gap-1 text-sm text-neutral-300">Distrito<select className="min-w-48 rounded-xl border border-white/15 bg-neutral-900 px-3 py-2 text-white" value={district} onChange={e=>setDistrict(e.target.value)}><option value="">Todos los distritos</option>{districts.map(item=><option key={item} value={item}>{item}</option>)}</select></label>}
      </div>
      {loading?<p role="status" className="rounded-2xl border border-white/10 p-8 text-center text-neutral-300">Cargando vacantes…</p>
       :error?<p role="alert" className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-red-200">{error}</p>
       :visibleJobs.length===0?<div className="rounded-2xl border border-dashed border-white/15 p-10 text-center"><h2 className="text-lg font-bold">{jobs.length?'No hay vacantes en este distrito':'Aún no hay vacantes publicadas'}</h2><p className="mt-2 text-sm text-neutral-400">{jobs.length?'Prueba con otro distrito.':'Las nuevas oportunidades aparecerán aquí cuando una barbería las publique.'}</p>{district&&<button type="button" onClick={()=>setDistrict('')} className="mt-4 rounded-xl border border-white/20 px-4 py-2 text-sm">Ver todos</button>}</div>
       :<div className="grid gap-4 md:grid-cols-2">{visibleJobs.map(job=>{
         const contact=contactUrl(job.whatsapp);
         return <article key={job.id} className="rounded-2xl border border-white/10 bg-neutral-900 p-5 shadow-lg shadow-black/20">
           <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-amber-300">{job.barberia||'Barbería MERYO'}</p><h3 className="mt-1 text-xl font-bold">{job.puesto}</h3></div><span className="shrink-0 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs text-amber-200">{job.distrito}</span></div>
           <p className="mt-4 text-sm text-neutral-300"><span className="font-semibold text-white">Horario:</span> {job.horario}</p>
           {job.descripcion&&<p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-300">{job.descripcion}</p>}
           <p className="mt-4 text-xs text-neutral-500">Publicada {dateLabel(job.created_at)} · Vence {dateLabel(job.vence_el)}</p>
           {contact?<a href={contact} target="_blank" rel="noreferrer" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-amber-400 px-4 py-2 font-bold text-black hover:bg-amber-300">Contactar por WhatsApp</a>:<p className="mt-5 rounded-xl bg-white/5 px-4 py-3 text-sm text-neutral-400">Esta barbería aún no agregó su WhatsApp de contacto.</p>}
         </article>;
       })}</div>}
    </div>
  </main>;
}
