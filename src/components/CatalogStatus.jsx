export default function CatalogStatus({loading,error,empty,businessLabel='barberías'}){
 if(loading)return <p role="status" className="mb-6 text-neutral-400">Cargando {businessLabel}…</p>;
 if(error||!empty)return null;
 return <p role="status" className="mb-6 rounded-2xl border border-white/10 bg-neutral-900 p-8 text-center text-neutral-300">Próximamente encontrarás {businessLabel} aquí</p>;
}
