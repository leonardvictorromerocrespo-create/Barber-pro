import { useCallback, useEffect, useState } from 'react';
import { Cargando, Mensaje, btnGhost, btnPrimary, card, inputClass } from './ui';

function limaToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export default function CutCampaign({ api, shop }) {
  const [data, setData] = useState(null);
  const [from, setFrom] = useState(limaToday);
  const [to, setTo] = useState(limaToday);
  const [windows, setWindows] = useState([{ start: '09:00', end: '12:00' }]);
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await api.ownerCutCampaign();
      setData(result);
      if (result.campaign) {
        setFrom(result.campaign.starts_on);
        setTo(result.campaign.ends_on);
        setWindows(result.campaign.time_windows || [{ start: '09:00', end: '12:00' }]);
        setActive(result.campaign.active === true && result.campaign.expired !== true);
      }
      setError('');
    } catch (reason) { setError(reason.message); }
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  const updateWindow = (index, key, value) => setWindows(current => current.map((window, i) => i === index ? { ...window, [key]: value } : window));
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await api.saveCutCampaign({ startsOn: from, endsOn: to, windows, active });
      await load();
      setMessage(active ? 'Campaña guardada. El catálogo solo la mostrará mientras tenga turnos reservables.' : 'Campaña pausada. Ya no aparece en Promociones.');
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  if (!data && !error) return <Cargando />;
  const services = data?.eligible_services || [];
  const uncertain = data?.unclassified_services || [];
  const savedCampaign = data?.campaign;
  return <section className={`${card} space-y-5`} aria-labelledby="cut-campaign-title">
    <div><h2 id="cut-campaign-title" className="text-xl font-bold">Cortes al 50 %</h2><p className="mt-1 text-sm text-neutral-400">La campaña aplica automáticamente a todos los cortes que el servidor clasifica como elegibles. No se seleccionan servicios individualmente.</p></div>
    {savedCampaign && <p role="status" className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">Estado: {savedCampaign.expired ? 'finalizada' : savedCampaign.active ? 'activa' : 'pausada'} · {savedCampaign.starts_on}–{savedCampaign.ends_on}</p>}
    <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm">
      <h3 className="font-semibold text-amber-200">Servicios de corte reconocidos por MERYO ({services.length})</h3>
      {services.length ? <ul className="mt-2 list-inside list-disc text-neutral-300">{services.map(service => <li key={service.id}>{service.nombre} · S/ {Number(service.precio).toFixed(2)}</li>)}</ul> : <p className="mt-2 text-neutral-400">Aún no hay servicios de corte reservables reconocidos por el servidor.</p>}
      <p className="mt-3 text-xs text-neutral-400">Barba sola, tintes y paquetes no participan. Si un servicio de corte no está reconocido, revisa su categoría y nombre en Servicios; no se incluirá parcialmente.</p>
      {uncertain.length > 0 && <p className="mt-2 text-sm text-amber-200">Revisión necesaria: {uncertain.map(item => item.nombre).join(', ')} no coincide con la clasificación de corte del servidor.</p>}
    </div>
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Desde<input aria-label="Inicio de campaña" type="date" required min={limaToday()} value={from} onChange={event => setFrom(event.target.value)} className={`${inputClass} mt-1`} /></label>
        <label className="text-sm">Hasta<input aria-label="Fin de campaña" type="date" required min={from || limaToday()} value={to} onChange={event => setTo(event.target.value)} className={`${inputClass} mt-1`} /></label>
      </div>
      <fieldset className="space-y-3"><legend className="mb-2 text-sm font-semibold">Horarios participantes (hora de Lima)</legend>
        {windows.map((window, index) => <div key={index} className="flex flex-wrap items-end gap-3 rounded-xl border border-white/10 p-3">
          <label className="min-w-[125px] flex-1 text-sm">Desde<input aria-label={`Horario ${index + 1}, desde`} type="time" required value={window.start} onChange={event => updateWindow(index, 'start', event.target.value)} className={`${inputClass} mt-1`} /></label>
          <label className="min-w-[125px] flex-1 text-sm">Hasta<input aria-label={`Horario ${index + 1}, hasta`} type="time" required value={window.end} onChange={event => updateWindow(index, 'end', event.target.value)} className={`${inputClass} mt-1`} /></label>
          {windows.length > 1 && <button type="button" className={btnGhost} onClick={() => setWindows(current => current.filter((_, i) => i !== index))}>Quitar</button>}
        </div>)}
        <button type="button" disabled={windows.length >= 6} className={btnGhost} onClick={() => setWindows(current => [...current, { start: '14:00', end: '17:00' }])}>Agregar horario</button>
      </fieldset>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} className="mt-1" /><span>Activar campaña. Solo aparecerá si el negocio está publicado y quedan turnos reservables.</span></label>
      <p className="text-sm text-neutral-400">La reserva vuelve a validar campaña, precio habitual y horario en el servidor. Si el turno deja de estar disponible, no se cambia el precio.</p>
      {error && <Mensaje>{error}</Mensaje>}{message && <Mensaje tipo="ok">{message}</Mensaje>}
      <button disabled={busy || !shop?.id} className={btnPrimary}>{busy ? 'Guardando…' : 'Guardar campaña'}</button>
    </form>
  </section>;
}
