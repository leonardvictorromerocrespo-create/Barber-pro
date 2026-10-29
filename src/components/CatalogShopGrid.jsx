const pointerClass="cursor-pointer";

export default function CatalogShopGrid({shops,onView,onReserve}) {
  return <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
    {shops.map(shop=><article key={shop.id} className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900">
      {shop.image?<img src={shop.image} className="h-20 w-full object-cover sm:h-36 lg:h-48" alt={shop.name}/>:<div className="flex h-20 items-center justify-center bg-neutral-950 text-xl font-black text-amber-400 sm:h-36 sm:text-3xl" aria-label="Sin portada publicada">MERYO</div>}
      <div className="min-w-0 p-2 sm:p-4">
        <div className="mb-1 flex min-w-0 items-start justify-between gap-1 sm:mb-2 sm:gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-1 break-words text-sm font-bold leading-tight sm:text-xl">{shop.name}</h3>
            <p className="line-clamp-1 text-[10px] text-neutral-400 sm:text-sm">{shop.district}{shop.km != null ? ` • A ${shop.km.toFixed(1)} km` : ""}</p>
          </div>
          {shop.discount && <span className="shrink-0 rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold leading-tight text-black sm:px-3 sm:py-1 sm:text-xs">{shop.discount}</span>}
        </div>
        <div className="mt-1 hidden flex-wrap gap-2 sm:flex">
          {(shop.tags??[]).map(tag=><span key={tag} className="rounded-full border border-white/10 px-3 py-1 text-xs text-neutral-300">{tag}</span>)}
        </div>
        <div className="mt-1 flex min-w-0 items-center justify-between gap-1 text-[10px] sm:mt-3 sm:text-sm">
          <span className="truncate">{shop.reviews>0?`⭐ ${shop.rating} (${shop.reviews})`:'Aún sin reseñas'}</span>
          <p className="shrink-0 font-semibold text-amber-400">{shop.basePrice==null?'Servicios por publicar':`Desde S/ ${shop.basePrice}`}</p>
        </div>
        <div className="mt-2 rounded-xl border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] text-neutral-300 sm:mt-4 sm:rounded-2xl sm:p-3 sm:text-sm">
          <p className="font-semibold text-white">Servicios:</p>
          <p className="mt-0.5 line-clamp-1 leading-tight sm:mt-1">{(shop.services??[]).map(service=>`${service.name} (${service.price})`).join(" • ")}</p>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:mt-5 sm:gap-3">
          <button onClick={()=>onView(shop)} className={`min-w-0 rounded-lg border border-white/20 bg-black/40 px-1 py-2 text-[10px] font-bold leading-tight text-white hover:bg-black/60 sm:rounded-xl sm:py-3 sm:text-sm ${pointerClass}`}>Ver barbería</button>
          <button onClick={()=>onReserve(shop)} className={`min-w-0 rounded-lg bg-amber-400 px-1 py-2 text-[10px] font-bold leading-tight text-black sm:rounded-xl sm:py-3 sm:text-sm ${pointerClass}`}>Reservar cita</button>
        </div>
      </div>
    </article>)}
  </div>;
}
