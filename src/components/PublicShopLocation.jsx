import {lazy,Suspense,useMemo} from 'react';
import {coordinates} from '../lib/catalog';import {shopDirections} from '../lib/shop-directions';
const CatalogMap=lazy(()=>import('./CatalogMap'));
export default function PublicShopLocation({shop,mapHeight='h-[300px]'}){
 const point=coordinates(shop),directions=shopDirections(shop),{id,name,direccion,lat,lng}=shop;
 const markers=useMemo(()=>{const p=coordinates({lat,lng});return p?[{id,lat:p.lat,lng:p.lng,title:name,detail:direccion||''}]:[];},[id,name,direccion,lat,lng]);
 if(!point&&!direccion&&!shop.district)return null;
 return <section className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4"><h4 className="border-b border-amber-400/40 pb-2 text-lg font-bold text-amber-300">Ubicación</h4><p className="text-sm text-neutral-300">{shop.direccion||'Dirección no publicada'}{shop.district?' · '+shop.district:''}</p>{point?<><Suspense fallback={<p className="text-sm text-neutral-400">Cargando mapa…</p>}><CatalogMap markers={markers} focusZoom={17} label={`Ubicación de ${shop.name}`} mapHeight={mapHeight}/></Suspense><a href={directions} target="_blank" rel="noopener noreferrer" className="inline-block rounded-xl border border-amber-400/40 px-4 py-2 font-bold text-amber-300">Cómo llegar</a></>:<p className="text-sm text-neutral-400">La barbería aún no publicó su ubicación en el mapa.</p>}</section>;
}
