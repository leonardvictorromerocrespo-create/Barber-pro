export default function CatalogStatus({loading,error,empty,businessLabel='barberías',onRetry}){
 if(loading)return <p role="status" className="mb-6 text-neutral-400">Cargando {businessLabel}…</p>;
 if(error)return <div role="alert" className="mb-6 rounded-2xl border border-red-400/30 bg-neutral-900 p-6 text-neutral-200"><p>No pudimos cargar {businessLabel}.</p><p className="mt-2 text-sm text-neutral-400">{error}</p><button type="button" onClick={onRetry} className="mt-4 min-h-11 rounded-xl border border-amber-400/50 px-4 py-2 font-semibold text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300">Reintentar</button></div>;
 if(!empty)return null;
 return <p role="status" className="mb-6 rounded-2xl border border-white/10 bg-neutral-900 p-8 text-center text-neutral-300">Próximamente encontrarás {businessLabel} aquí</p>;
}
