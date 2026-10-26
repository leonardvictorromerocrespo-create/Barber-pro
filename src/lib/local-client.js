// Local facade for the existing MERYO UI. Does not emulate Supabase services.
const blocked = (message = 'Operación no disponible: pruebas locales sin Supabase Auth') => ({ data: null, error: { message, code: 'LOCAL_ONLY' } });
export function createLocalClient(fetchImpl = (...args) => fetch(...args)) {
  const listeners = new Set();
  function from(table) {
    const filters = [];
    let forbidden = false;
    let single = false;
    const query = {
      select() { return query; },
      eq(key, value) { filters.push([key, value]); return query; },
      order() { return query; },
      single() { single = true; return query; },
      insert() { forbidden = true; return query; },
      update() { forbidden = true; return query; },
      delete() { forbidden = true; return query; },
      upsert() { forbidden = true; return query; },
      async then(resolve, reject) {
        try {
          if (forbidden || !['barberias','servicios','horarios'].includes(table)) return resolve(blocked('Falta Supabase Auth de pruebas para esta operación. No se envió ninguna escritura.'));
          const response = await fetchImpl(table==='barberias'?'/__local/catalog':`/__local/public/${table}`, { redirect: 'error' });
          if (!response.ok) return resolve(blocked('El servidor PostgreSQL local no respondió'));
          let rows = await response.json();
          for (const [key, value] of filters) rows = rows.filter(row => row[key] === value);
          return resolve({ data: single ? rows[0] ?? null : rows, error: null });
        } catch (error) { return reject(error); }
      },
    };
    return query;
  }
  const client = {
    authUnavailable: true,
    from,
    rpc: async (name,args) => {
      if(name!=='horarios_disponibles')return blocked();
      try {
        const params=new URLSearchParams({shop:args.p_barberia_id,service:args.p_servicio_id,day:args.p_fecha});
        const response=await fetchImpl(`/__local/agenda?${params}`,{redirect:'error'});const body=await response.json();
        return response.ok?{data:body,error:null}:blocked(body.error);
      }catch{return blocked('No se pudo consultar la agenda local');}
    },
    schema: () => ({ rpc: async () => blocked() }),
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signInWithPassword: async () => blocked(),
      signUp: async () => blocked(),
      signOut: async () => { for (const fn of listeners) fn('SIGNED_OUT', null); return { error: null }; },
      onAuthStateChange: fn => { listeners.add(fn); return { data: { subscription: { unsubscribe: () => listeners.delete(fn) } } }; },
    },
  };
  return client;
}

export function isLoopbackHost(hostname) {
  return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname);
}
