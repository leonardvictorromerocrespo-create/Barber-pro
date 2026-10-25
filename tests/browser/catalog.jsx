// Isolated UI fixture: no Auth/Supabase imports, no real users or business data.
import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import CatalogFilters from '../../src/components/CatalogFilters';
import CatalogMap from '../../src/components/CatalogMap';
import { selectShops, catalogMarkers } from '../../src/lib/catalog';

const fixtures = [
  {id:1,name:'Prueba Rímac',district:'Rímac',rating:4.8,basePrice:30,lat:-12.04,lng:-77.04},
  {id:2,name:'Prueba Ate',district:'Ate',rating:4.5,basePrice:20},
];
export default function Preview() {
  const [query,setQuery]=useState(''),[district,setDistrict]=useState(''),[order,setOrder]=useState('rating'),[show,setShow]=useState(false),[selected,setSelected]=useState(null);
  const result=useMemo(()=>selectShops(fixtures,{query,district,order}),[query,district,order]);
  const markers=useMemo(()=>catalogMarkers(result),[result]);
  return <main className="min-h-screen bg-neutral-950 p-6 text-white">
    <h1 className="text-3xl font-black">MERYO — prueba aislada</h1>
    <CatalogFilters query={query} district={district} order={order} hasLocation={false} onQuery={setQuery} onDistrict={setDistrict} onOrder={setOrder}/>
    <p role="status">{result.length} resultados de prueba</p>
    <ul>{result.map(shop=><li key={shop.id}>{shop.name} · S/ {shop.basePrice}</li>)}</ul>
    <button onClick={()=>setShow(value=>!value)} className="my-4 rounded-xl bg-amber-400 px-4 py-2 text-black">{show?'Ocultar mapa':'Ver mapa'}</button>
    {show&&<CatalogMap markers={markers} location={null} onSelect={setSelected}/>}
    {selected&&<p>Perfil seleccionado: {selected}</p>}
  </main>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><Preview/></React.StrictMode>);
