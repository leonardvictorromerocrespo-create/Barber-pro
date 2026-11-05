import {lazy,Suspense,useMemo} from 'react';
import {coordinates} from '../lib/catalog';import {shopDirections} from '../lib/shop-directions';
const CatalogMap=lazy(()=>import('./CatalogMap'));
export default function PublicShopLocation({shop,mapHeight='h-[300px]',className='mt-4'}){
 const point=coordinates(shop),directions=shopDirections(shop),{id,name,direccion,lat,lng}=shop;
 const markers=useMemo(()=>{const p=coordinates({lat,lng});return p?[{id,lat:p.lat,lng:p.lng,title:name,detail:direccion||''}]:[];},[id,name,direccion,lat,lng]);
 if(!point&&!direccion&&!shop.district)return null;
 return <section className={`${className} min-w-0 space-y-3 rounded-xl border border-white/10 bg-black/20 p-2 sm:rounded-2xl sm:p-4`}><h4 className="border-b border-amber-400/40 pb-2 text-lg font-bold text-amber-300">Ubicación</h4><p className="break-words text-xs text-neutral-300 sm:text-sm">{shop.direccion||'Dirección no publicada'}{shop.district?' · '+shop.district:''}</p>{point?<><Suspense fallback={<p className="text-xs text-neutral-400">Cargando mapa…</p>}><CatalogMap markers={markers} focusZoom={17} label={`Ubicación de ${shop.name}`} mapHeight={mapHeight}/></Suspense><a href={directions} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-400/40 px-3 py-2 text-xs font-bold text-amber-300 sm:px-4 sm:text-sm">Cómo llegar</a></>:<p className="text-xs text-neutral-400 sm:text-sm">La barbería aún no publicó su ubicación en el mapa.</p>}</section>;
}
