import BarberShortcutIcon from './BarberShortcutIcon';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fechaLima, sumarDias } from '../lib/dates';
import { findTurns, turnKey } from '../lib/turn-finder';

const field = 'meryo-turn-finder__field mt-1 block min-h-11 w-full min-w-0 rounded-md px-3 py-2';

const money = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
const readableDate = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const dayLabel = date => readableDate.format(new Date(date + 'T12:00:00Z'));

function TurnCard({ turn, onReserve }) {
  const [selected, setSelected] = useState(turn.slot.time);
  const slot = turn.options.find(option => option.time === selected) ?? turn.slot;
  const initials = turn.shop.name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toLocaleUpperCase('es');
  return <li className="meryo-turn-finder__result turn-card min-w-0 rounded-xl p-4">
    <div className="turn-card__heading">
      <div className="turn-card__avatar" aria-hidden="true">{initials}</div>
      <div className="min-w-0">
        <h3 className="break-words font-semibold">{turn.shop.name}</h3>
        <p className="turn-muted text-sm break-words">{turn.shop.district} · {turn.member.nombre}</p>
      </div>
    </div>
    <div className="turn-card__service">
      <div className="min-w-0">
        <p className="break-words font-medium">{turn.service.name}</p>
        <p className="turn-muted text-sm">{turn.service.durationMinutes} min</p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-semibold tabular-nums">{money.format(turn.service.price)}</p>
        <p className="turn-muted text-xs">Precio habitual</p>
      </div>
    </div>
    <div role="group" aria-label={'Horarios de ' + turn.member.nombre} className="turn-card__slots">
      {turn.options.map(option => <button key={option.time} type="button" aria-pressed={selected === option.time}
        className="turn-pill min-h-11 rounded-lg px-3 text-sm font-semibold tabular-nums"
        onClick={() => setSelected(option.time)}>{option.label}</button>)}
    </div>
    <button type="button" className="meryo-turn-finder__action mt-3 min-h-11 w-full rounded-lg px-3 text-sm font-semibold"
      onClick={() => onReserve({ ...turn, slot })}>Solicitar turno · {slot.label}</button>
  </li>;
}

export default function TurnFinder({ shops, slots, onReserve, themeMode = 'dark', themeAppearance, category = 'barberia', disabled = false }) {
  const activeCategory = category === 'belleza' ? 'belleza' : 'barberia';
  const [district, setDistrict] = useState('');
  const [service, setService] = useState('');
  const [day, setDay] = useState('today');
  const [customDate, setCustomDate] = useState('');
  const [after, setAfter] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [order, setOrder] = useState('soonest');
  const currentDay = fechaLima(Date.now());
  const tomorrow = sumarDias(currentDay, 1);
  const lastDay = sumarDias(currentDay, 30);
  const date = day === 'tomorrow' ? tomorrow : day === 'custom' ? (customDate || currentDay) : currentDay;
  const [max, setMax] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [staleSearch, setStaleSearch] = useState(false);
  const [open, setOpen] = useState(false);
  const generation = useRef(0);
  const running = useRef(false);
  const triggerRef = useRef(null);
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  const closeFinder = useCallback(() => {
    generation.current += 1;
    setResult(null);
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
      if (event.key === 'Escape') { event.preventDefault(); closeFinder(); return; }
      if (event.key !== 'Tab') return;
      const controls = [...(dialogRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)') ?? [])]
        .filter(element => element.getClientRects().length);
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
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
      after: after || '00:00',
      max,
      notBefore: Date.now(),
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

  const changeDay = value => { invalidate(); setDay(value); };
  const resetAdvanced = () => { invalidate(); setAfter(''); setMax(''); };
  const matches = result?.matches ?? [];
  const ordered = order === 'price' ? [...matches].sort((a, b) => a.service.price - b.service.price) : matches;
  const partial = result && !result.allFailed && (result.failed > 0 || result.limited);

  const reserveTurn = turn => {
    setOpen(false);
    onReserve(turn);
  };

  return <section
    data-meryo-theme={activeCategory === 'belleza' ? 'beauty' : 'barberia'}
    data-meryo-mode={themeMode}
    data-meryo-appearance={themeAppearance}
    className="meryo-turn-finder min-w-0 w-full"
  >
    <button ref={triggerRef} type="button" aria-haspopup="dialog" aria-expanded={open}
      aria-controls="meryo-turn-finder-dialog"
      disabled={disabled}
      onClick={() => setOpen(true)}
      className="meryo-turn-finder__trigger inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md px-3 py-2 font-medium shadow-sm">
      {activeCategory==='barberia'?<BarberShortcutIcon kind="today"/>:<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-4 shrink-0" stroke="currentColor" strokeWidth="1.8">
        <circle cx="10.8" cy="10.8" r="6.4"/><path d="m16 16 4.2 4.2"/>
      </svg>}
      <span>Turnos para hoy</span>
    </button>

    {open&&<div className="meryo-turn-finder__backdrop fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-5"
      onMouseDown={event=>{if(event.target===event.currentTarget)closeFinder();}}>
      <section ref={dialogRef} id="meryo-turn-finder-dialog" role="dialog" aria-modal="true" aria-labelledby="meryo-turn-finder-title"
        data-meryo-theme={activeCategory === 'belleza' ? 'beauty' : 'barberia'} data-meryo-mode={themeMode} data-meryo-appearance={themeAppearance}
        className="meryo-turn-finder__dialog turn-dialog w-full max-w-4xl overflow-y-auto overscroll-contain rounded-xl">
        <header className="turn-hero">
          <div className="turn-hero__top">
            <p className="turn-hero__eyebrow"><span aria-hidden="true"/> {activeCategory === 'belleza' ? 'Salones y belleza' : 'Barberías'} · Horarios en vivo</p>
            <button ref={closeRef} type="button" onClick={closeFinder} aria-label="Cerrar buscador de turnos"
              className="meryo-turn-finder__close turn-hero__close rounded-lg">
              <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m6 6 12 12M18 6 6 18"/></svg>
            </button>
          </div>
          <h2 id="meryo-turn-finder-title" className="turn-hero__title">{day === 'today' ? 'Turnos para hoy' : day === 'tomorrow' ? 'Turnos para mañana' : 'Encuentra un turno'}</h2>
          <p className="turn-muted text-sm">Encuentra un horario disponible, compara precios y elige a tu profesional.</p>
        </header>

        <div className="turn-body">
          <form onSubmit={search} className="turn-form">
            <div className="turn-form__days" role="group" aria-label="Día de la cita">
              {[['today', 'Hoy'], ['tomorrow', 'Mañana'], ['custom', 'Otra fecha']].map(([value, label]) =>
                <button key={value} type="button" className="turn-pill min-h-11 rounded-lg px-3 text-sm font-semibold"
                  aria-pressed={day === value} onClick={() => changeDay(value)}>{label}</button>)}
            </div>
            <div className="turn-form__main">
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
            </div>
            {day === 'custom' && <label className="block min-w-0">Fecha de la cita
              <input name="date" className={field} type="date" required min={currentDay} max={lastDay} value={date}
                onChange={event => { invalidate(); setCustomDate(event.target.value); }}/>
            </label>}
            <button type="button" className="turn-filter-toggle min-h-11 text-sm font-semibold" aria-expanded={advanced}
              aria-controls="meryo-turn-advanced" onClick={() => setAdvanced(value => !value)}>
              <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 7h16M4 17h16M9 4v6m6 4v6"/></svg>
              {advanced ? 'Ocultar filtros' : 'Más filtros'}{(after || max) && ' · activos'}
            </button>
            <div id="meryo-turn-advanced" hidden={!advanced}>
              <div className="turn-form__main">
                <label className="min-w-0">Desde las <span className="turn-muted">(opcional)</span>
                  <input name="after" className={field} type="time" value={after} onChange={event => { invalidate(); setAfter(event.target.value); }}/>
                </label>
                <label className="min-w-0">Presupuesto máx. <span className="turn-muted">(opcional)</span>
                  <input name="max" className={field} type="number" min="0.01" step="0.01" placeholder="S/ 40" value={max} onChange={event => { invalidate(); setMax(event.target.value); }}/>
                </label>
              </div>
              {(after || max) && <button type="button" className="turn-filter-toggle min-h-11 text-sm" onClick={resetAdvanced}>Limpiar filtros</button>}
            </div>
            <button type="submit" className="meryo-turn-finder__action min-h-11 w-full rounded-lg px-4 py-2 font-semibold"
              disabled={loading || !district || !service}>{loading ? 'Buscando horarios…' : day === 'today' ? 'Ver turnos de hoy' : 'Ver horarios disponibles'}</button>
          </form>

          <div aria-busy={loading} className="turn-results">
            <div role="status" aria-live="polite" className="turn-muted text-sm">
              {loading ? staleSearch ? 'Los filtros cambiaron. En un momento podrás buscar de nuevo.' : 'Estamos consultando las agendas…'
                : result?.allFailed ? 'No pudimos consultar las agendas. Vuelve a buscar para reintentar.'
                : matches.length ? `${matches.length} ${matches.length === 1 ? 'opción' : 'opciones'} · ${dayLabel(date)}`
                : result && !partial ? 'No encontramos horarios para esta búsqueda. Prueba otro día o ajusta los filtros.' : null}
            </div>
            {partial && <p className="turn-result-note">Búsqueda parcial: no se pudieron revisar todas las agendas.
              {!matches.length && ' Esto no significa que todos los horarios estén ocupados.'}</p>}
            {matches.length > 0 && <>
              <div className="turn-results__sort">
                <label className="turn-muted text-sm" htmlFor="meryo-turn-sort">Ordenar por</label>
                <select id="meryo-turn-sort" className="turn-pill min-h-11 rounded-lg px-2 text-sm" value={order}
                  onChange={event => setOrder(event.target.value)}><option value="soonest">Primero disponible</option><option value="price">Menor precio</option></select>
              </div>
              <ul className="turn-results__grid">
                {ordered.map(turn => <TurnCard key={JSON.stringify([turn.shop.id, turn.service.id, turn.member.id])} turn={turn} onReserve={reserveTurn}/>)}
              </ul>
            </>}
          </div>
        </div>
      </section>
    </div>}
  </section>;
}
