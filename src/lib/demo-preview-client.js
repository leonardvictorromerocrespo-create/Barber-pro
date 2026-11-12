// UI-only data for an explicitly enabled Vercel Preview environment.
// Never use this client for production or any environment with Supabase configured.
const sampleShop = {
  id: 9001,
  nombre: 'Barbería de muestra',
  distrito: 'Ate Vitarte',
  descripcion: 'Vista previa de la interfaz con datos ficticios.',
  imagen_url: '',
  rating: 0,
  total_resenas: 0,
  reviews_verified: false,
  precio_desde: 25,
  tipos_negocio: ['barberia'],
  assets: [],
  servicios: [
    { id: 9101, nombre: 'Corte clásico (muestra)', categoria: 'corte', precio: 25, duracion_min: 30, activo: true, requiere_evaluacion: false },
    { id: 9102, nombre: 'Fade (muestra)', categoria: 'corte', precio: 30, duracion_min: 35, activo: true, requiere_evaluacion: false },
    { id: 9103, nombre: 'Corte + barba (muestra)', categoria: 'barba', precio: 40, duracion_min: 50, activo: true, requiere_evaluacion: false },
  ],
};

function response(data) {
  const result = Promise.resolve({ data, error: null });
  result.abortSignal = () => result;
  return result;
}

export function createDemoPreviewClient() {
  const listeners = new Set();
  return {
    authUnavailable: true,
    demoPreview: true,
    rpc: (name, args = {}) => {
      if (name === 'meryo_catalogo_categoria') {
        return response(args.p_categoria === 'barberia' ? [sampleShop] : []);
      }
      return response([]);
    },
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: callback => {
        listeners.add(callback);
        return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } };
      },
    },
  };
}
