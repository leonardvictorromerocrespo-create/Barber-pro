import { DISTRITOS } from '../lib/distritos';

export default function CatalogFilters({ query, district, order, hasLocation, onQuery, onDistrict, onOrder }) {
  const style = 'rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm';
  return <div className="mt-3 flex flex-wrap gap-3">
    <input aria-label="Buscar barbería por nombre o distrito" placeholder="Buscar barbería" value={query} onChange={event => onQuery(event.target.value)} className={style} />
    <select aria-label="Distrito" value={district} onChange={event => onDistrict(event.target.value)} className={style}>
      <option value="">Todos los distritos</option>
      {DISTRITOS.map(value => <option key={value} value={value}>{value}</option>)}
    </select>
    <select aria-label="Ordenar barberías" value={order} onChange={event => onOrder(event.target.value)} className={style}>
      <option value="rating">Mejor calificadas</option><option value="price">Menor precio</option>
      <option value="distance" disabled={!hasLocation}>Más cercanas</option>
    </select>
  </div>;
}
