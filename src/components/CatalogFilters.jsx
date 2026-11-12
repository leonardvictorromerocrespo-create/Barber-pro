import {DISTRITOS} from '../lib/distritos';

const fieldClass='meryo-catalog-field min-h-11 min-w-0 rounded-lg px-3 py-2 text-sm';

export default function CatalogFilters({
  query,district,order,hasLocation,onQuery,onDistrict,onOrder,onUseLocation,
  onClearFilters=()=>{},showSearch=true,districtPrompt='Todos los distritos',businessLabel='barbería',businessPlural='barberías',
}) {
  const secondaryCount=Number(Boolean(hasLocation))+Number(order!=='name');
  const active=[
    showSearch&&query&&{key:'query',label:`Texto: ${query}`},
    district&&{key:'district',label:district},
    hasLocation&&{key:'location',label:'Ubicación activa'},
    order!=='name'&&{key:'order',label:order==='price'?'Menor precio':'Más cercanas'},
  ].filter(Boolean);

  return <section className="meryo-catalog-controls" aria-label={`Buscar ${businessPlural}`}>
    {showSearch&&<><label className="sr-only" htmlFor="meryo-catalog-search">Buscar {businessLabel} por nombre o distrito</label>
    <input id="meryo-catalog-search" type="search" autoComplete="off" value={query}
      onChange={event=>onQuery(event.target.value)} placeholder="Nombre del negocio o distrito"
      className={`${fieldClass} meryo-catalog-search w-full`}/></>}
    <div className="meryo-catalog-filter-row mt-2">
      <label className="min-w-0 flex-1">
        <span className="sr-only">Distrito</span>
        <select aria-label="Distrito" value={district} onChange={event=>onDistrict(event.target.value)} className={`${fieldClass} w-full`}>
          <option value="">{districtPrompt}</option>
          {DISTRITOS.map(value=><option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <details className="meryo-catalog-more-filters min-w-0 flex-1">
        <summary className="meryo-catalog-filter-summary min-h-11 rounded-lg px-3 py-2 text-sm font-medium">
          <span>Filtros{secondaryCount>0&&<span className="meryo-filter-count" aria-label={`${secondaryCount} filtros activos`}>{secondaryCount}</span>}</span>
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5 7.5 5 5 5-5"/></svg>
        </summary>
        <div className="meryo-catalog-more-panel mt-2 grid gap-2 rounded-lg p-3 md:absolute md:z-20 md:min-w-64">
          {onUseLocation&&<button type="button" onClick={onUseLocation} className="meryo-catalog-control-button min-h-11 rounded-lg px-3 py-2 text-left text-sm font-semibold">{hasLocation?'Actualizar ubicación':'Usar mi ubicación'}</button>}
          <label className="block text-xs font-semibold">Ordenar
            <select aria-label={`Ordenar ${businessPlural}`} value={order} onChange={event=>onOrder(event.target.value)} className={`${fieldClass} mt-1 w-full`}>
              <option value="name">Por nombre</option><option value="price">Menor precio</option>
              <option value="distance" disabled={!hasLocation}>Más cercanas</option>
            </select>
          </label>
        </div>
      </details>
    </div>
    {active.length>0&&<div className="meryo-active-filters mt-2 flex flex-wrap items-center gap-2" aria-label="Filtros activos">
      {active.map(item=><span key={item.key} className="meryo-active-filter min-h-8 rounded-md px-2 py-1 text-xs">{item.label}</span>)}
      <button type="button" className="meryo-clear-filters min-h-8 rounded-md px-2 py-1 text-xs font-semibold" onClick={onClearFilters}>Limpiar filtros</button>
    </div>}
  </section>;
}
