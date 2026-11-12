const businessLabel=(shop,category)=>category==='belleza'?'Salón de belleza':shop.businessTypes?.includes('belleza')?'Barbería y salón':'Barbería';

export default function CatalogShopGrid({shops,category='barberia',onView,onReserve=()=>{},renderLike}) {
  return <div className="meryo-shop-grid" aria-label={category==='belleza'?'Salones publicados':'Barberías publicadas'}>
    {shops.map(shop=>{
      const label=businessLabel(shop,category);
      const ratingIsVerified=Number.isFinite(Number(shop.rating))&&Number(shop.rating)>=1&&Number(shop.rating)<=5&&Number(shop.reviews)>0;
      const reservable=(shop.services??[]).filter(service=>service.bookable&&Number.isFinite(Number(service.price))&&Number(service.price)>0);
      const servicePrices=reservable.map(service=>Number(service.price));
      const price=Number.isFinite(Number(shop.basePrice))&&Number(shop.basePrice)>0?Number(shop.basePrice):servicePrices.length?Math.min(...servicePrices):null;
      const services=(shop.services??[]).filter(service=>service.name);
      const serviceSummary=services.length
        ?`${services.slice(0,2).map(service=>service.name).join(' · ')}${services.length>2?` · +${services.length-2}`:''}`
        :'Servicios aún no publicados';
      return <article key={shop.id} className="meryo-shop-card min-w-0 overflow-hidden rounded-xl">
        <div className="meryo-shop-card__image">
          {shop.image?<img src={shop.image} alt={`Portada de ${shop.name}`} loading="lazy"/>:<div className="meryo-shop-card__placeholder" role="img" aria-label="Sin fotografía de portada publicada"/>}
        </div>
        <div className="meryo-shop-card__content min-w-0">
          {renderLike?<div className="meryo-shop-card__title-row"><p className="meryo-shop-card__category">{label}</p>{renderLike(shop)}</div>:<p className="meryo-shop-card__category">{label}</p>}
          <h2 className="meryo-shop-card__name">{shop.name}</h2>
          <p className="meryo-shop-card__district">{shop.district||'Distrito no publicado'}</p>
          <div className="meryo-shop-card__facts">
            <span className="meryo-shop-card__rating">{ratingIsVerified?<span aria-label={`${Number(shop.rating).toFixed(1)} de 5 según ${shop.reviews} reseñas`}>★ {Number(shop.rating).toFixed(1)} · {shop.reviews}</span>:'Aún sin reseñas'}</span>
            <span className="meryo-shop-card__price">{price!==null?`Desde S/ ${price.toFixed(2)}`:'Precio por consultar'}</span>
          </div>
          <p className="meryo-shop-card__service-summary" title={serviceSummary}>{serviceSummary}</p>
          <div className="meryo-shop-card__actions">
            <button type="button" onClick={()=>onView(shop)} className="meryo-shop-card__profile-action min-h-11 rounded-lg px-2 py-2 text-sm font-semibold">{category==='belleza'?'Ver salón':'Ver barbería'}</button>
            <button type="button" disabled={!reservable.length} onClick={()=>onReserve(shop)} className="meryo-shop-card__booking-action min-h-11 rounded-lg px-2 py-2 text-sm font-semibold">Reservar cita</button>
          </div>
        </div>
      </article>;
    })}
  </div>;
}
