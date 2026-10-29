import { DISTRITOS } from '../lib/distritos';

export default function CatalogFilters({ query, district, order, hasLocation, onQuery, onDistrict, onOrder, onUseLocation }) {
  const style = 'rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm';
  return <div className="mt-3 grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-3">
    <input aria-label="Buscar barbería por nombre o distrito" placeholder="Buscar barbería" value={query} onChange={event => onQuery(event.target.value)} className={`${style} min-h-11 min-w-0 col-span-2 w-full md:min-h-0 md:col-span-1 md:w-auto`} />
    <select aria-label="Distrito" value={district} onChange={event => onDistrict(event.target.value)} className={`${style} min-h-11 min-w-0 w-full md:min-h-0 md:w-auto`}>
      <option value="">Todos los distritos</option>
      {DISTRITOS.map(value => <option key={value} value={value}>{value}</option>)}
    </select>
    {onUseLocation && <button type="button" onClick={onUseLocation} className="min-h-11 w-full whitespace-nowrap rounded-xl bg-amber-400 px-2 py-2 text-xs font-semibold text-black md:hidden">Usar ubicación</button>}
    <select aria-label="Ordenar barberías" value={order} onChange={event => onOrder(event.target.value)} className={`${style} min-h-11 min-w-0 col-span-2 w-full md:min-h-0 md:col-span-1 md:w-auto`}>
      <option value="name">Por nombre</option><option value="price">Menor precio</option>
      <option value="distance" disabled={!hasLocation}>Más cercanas</option>
    </select>
  </div>;
}
