import { useCallback, useEffect, useRef, useState } from 'react';
import { findTurns, turnKey } from '../lib/turn-finder';

const field = 'meryo-turn-finder__field mt-1 block min-h-11 w-full min-w-0 rounded-md px-3 py-2';

function resultMessage(result) {
  if (!result) return '';
  if (result.allFailed) return 'No pudimos consultar las agendas. No se enviaron consultas de reserva; vuelve a intentar.';
  if (result.failed || result.limited) {
    return result.matches.length
      ? `Búsqueda parcial: ${result.matches.length} opciones confirmadas; algunas agendas no respondieron o quedaron fuera del límite. Puedes buscar de nuevo.`
      : 'Búsqueda parcial: algunas agendas no respondieron o quedaron fuera del límite. No se puede confirmar que no haya turnos.';
  }
  return result.matches.length
    ? `${result.matches.length} opciones encontradas.`
    : 'No encontramos turnos con esos filtros. Prueba otra hora, fecha o distrito.';
}

export default function TurnFinder({ shops, today, maxDate, slots, onReserve, themeMode = 'dark', category = 'barberia', disabled = false }) {
  const activeCategory = category === 'belleza' ? 'belleza' : 'barberia';
  const [district, setDistrict] = useState('');
  const [service, setService] = useState('');
  const [date, setDate] = useState(today);
  const [after, setAfter] = useState('09:00');
  const [max, setMax] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [staleSearch, setStaleSearch] = useState(false);
  const [open, setOpen] = useState(false);
  const generation = useRef(0);
  const running = useRef(false);
  const triggerRef = useRef(null);
  const closeRef = useRef(null);
  const closeFinder = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);
  useEffect(() => () => { generation.current += 1; }, []);
  useEffect(() => {
    generation.current += 1;
    setResult(null);
    if (running.current) setStaleSearch(true);
  }, [shops, activeCategory]);
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = event => {
      if (event.key === 'Escape') closeFinder();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, closeFinder]);

  const categoryShops = (shops ?? []).filter(shop => {
    const types = Array.isArray(shop.businessTypes) && shop.businessTypes.length ? shop.businessTypes : ['barberia'];
    return types.includes(activeCategory) || types.includes('ambos');
  });

  const districts = new Map(categoryShops.filter(shop => shop.district)
    .map(shop => [turnKey(shop.district), shop.district]));
  const services = new Map(categoryShops
    .filter(shop => turnKey(shop.district) === district)
    .flatMap(shop => (shop.services ?? [])
      .filter(item => item.bookable && item.requiresEvaluation !== true && item.name &&
        Number.isFinite(Number(item.price)) && Number(item.price) > 0 &&
        Number.isInteger(Number(item.durationMinutes)) && Number(item.durationMinutes) > 0)
      .map(item => [turnKey(item.name), item.name])));

  const invalidate = () => {
    generation.current += 1;
    setResult(null);
    if (running.current) setStaleSearch(true);
  };

  const search = async event => {
    event.preventDefault();
    if (running.current) return;
    const request = ++generation.current;
    const filters = {
      district,
      service,
      date,
      after,
      max: Number(max),
    };
    running.current = true;
    setLoading(true);
    setStaleSearch(false);
    setResult(null);
    try {
      const next = await findTurns(categoryShops, { ...filters, category: activeCategory }, slots, () => generation.current === request);
      if (generation.current === request) setResult(next);
    } catch (error) {
      if (generation.current === request) {
        setResult({ matches: [], checked: 0, failed: 1, limited: false, allFailed: true, message: error?.message });
      }
    } finally {
      running.current = false;
      setLoading(false);
      setStaleSearch(false);
    }
  };

  const dateLabel = date => new Intl.DateTimeFormat('es-PE', {
    timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(`${date}T12:00:00Z`));

  const reserveTurn = turn => {
    setOpen(false);
    onReserve(turn);
  };

  return <section
    data-meryo-theme={activeCategory === 'belleza' ? 'beauty' : 'barberia'}
    data-meryo-mode={themeMode}
    className="meryo-turn-finder min-w-0 w-full"
  >
    <button ref={triggerRef} type="button" aria-haspopup="dialog" aria-expanded={open}
      aria-controls="meryo-turn-finder-dialog"
      disabled={disabled}
      onClick={() => setOpen(true)}
      className="meryo-turn-finder__trigger inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md px-3 py-2 font-medium shadow-sm">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-4 shrink-0" stroke="currentColor" strokeWidth="1.8">
        <circle cx="10.8" cy="10.8" r="6.4"/><path d="m16 16 4.2 4.2"/>
      </svg>
      <span>Buscar turno</span>
    </button>

    {open&&<div className="meryo-turn-finder__backdrop fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-5"
      onMouseDown={event=>{if(event.target===event.currentTarget)closeFinder();}}>
      <section id="meryo-turn-finder-dialog" role="dialog" aria-modal="true" aria-labelledby="meryo-turn-finder-title"
        data-meryo-theme={activeCategory === 'belleza' ? 'beauty' : 'barberia'} data-meryo-mode={themeMode}
        className="meryo-turn-finder__dialog max-h-[92dvh] w-full max-w-5xl overflow-y-auto overscroll-contain rounded-xl p-4 shadow-2xl sm:p-6">
        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="meryo-turn-finder-title" className="text-xl font-bold sm:text-2xl">Encuéntrame un turno</h2>
            <p className="mt-1 text-sm opacity-80">Comparamos los servicios publicados y consultamos horarios reales por profesional.</p>
          </div>
          <button ref={closeRef} type="button" onClick={closeFinder}
            className="meryo-turn-finder__close min-h-11 shrink-0 rounded-md px-3 py-2 text-sm font-semibold">
            Volver al catálogo
          </button>
        </header>
        <form onSubmit={search} className="grid min-w-0 grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-6">
      <label className="min-w-0">Distrito
        <select name="district" className={field} required value={district} onChange={event => { invalidate(); setDistrict(event.target.value); setService(''); }}>
          <option value="">Elige distrito</option>
          {[...districts].sort((a, b) => a[1].localeCompare(b[1], 'es')).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <label className="min-w-0">Servicio
        <select name="service" className={field} required disabled={!district} value={service} onChange={event => { invalidate(); setService(event.target.value); }}>
          <option value="">Elige servicio</option>
          {[...services].sort((a, b) => a[1].localeCompare(b[1], 'es')).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <label className="min-w-0">Fecha
        <input name="date" className={field} type="date" required min={today} max={maxDate} value={date} onChange={event => { invalidate(); setDate(event.target.value); }}/>
      </label>
      <label className="min-w-0">Hora mínima
        <input name="after" className={field} type="time" required value={after} onChange={event => { invalidate(); setAfter(event.target.value); }}/>
      </label>
      <label className="min-w-0">Presupuesto máximo (S/)
        <input name="max" className={field} type="number" required min="0.01" step="0.01" placeholder="Ej.: 40" value={max} onChange={event => { invalidate(); setMax(event.target.value); }}/>
      </label>
      <button className="meryo-turn-finder__action min-h-11 self-end rounded-md px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-60" disabled={loading || !service}>
        {loading ? 'Buscando…' : 'Buscar turno'}
      </button>
        </form>
        <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm opacity-85">
      {staleSearch ? 'Los filtros cambiaron. Espera a que termine la consulta anterior antes de buscar de nuevo.' :
        loading ? 'Consultando hasta 24 agendas, con un máximo de cuatro solicitudes simultáneas…' : result?.message || resultMessage(result)}
        </p>
        {result?.matches?.length > 0 && <ul className="mt-3 grid min-w-0 gap-3 md:grid-cols-2">
      {result.matches.map(turn => <li key={`${turn.shop.id}-${turn.service.id}-${turn.member.id}`} className="meryo-turn-finder__result min-w-0 rounded-lg p-4 shadow-sm">
        <h3 className="break-words font-bold">{turn.shop.name}</h3>
        <dl className="mt-2 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
          <dt className="opacity-70">Profesional</dt><dd className="min-w-0 break-words">{turn.member.nombre}</dd>
          <dt className="opacity-70">Servicio</dt><dd className="min-w-0 break-words">{turn.service.name}</dd>
          <dt className="opacity-70">Fecha</dt><dd>{dateLabel(turn.date)}</dd>
          <dt className="opacity-70">Hora</dt><dd>{turn.slot.label}</dd>
          <dt className="opacity-70">Precio habitual</dt><dd className="font-semibold tabular-nums">S/ {Number(turn.service.price).toFixed(2)}</dd>
        </dl>
        <button type="button" className="meryo-turn-finder__action mt-3 min-h-11 rounded-md px-4 py-2 font-bold" onClick={() => reserveTurn(turn)}>
          Reservar este turno
        </button>
      </li>)}
        </ul>}
      </section>
    </div>}
  </section>;
}
