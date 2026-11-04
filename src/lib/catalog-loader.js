// Keep each catalog response tied to the category that requested it. A later
// category change invalidates pending work before React runs its next effect.
export function createCatalogLoader(fetchCategory, publish, { timeoutMs = 15000 } = {}) {
  let generation = 0;
  let activeController = null;
  let activeTimeout = null;
  const cancelActive = () => {
    if (activeTimeout !== null) clearTimeout(activeTimeout);
    activeTimeout = null;
    activeController?.abort();
    activeController = null;
  };
  return {
    reset(category) {
      cancelActive();
      generation += 1;
      publish({ category, rows: [], loading: true, error: '' });
    },
    async load(category) {
      cancelActive();
      const current = ++generation;
      const controller = new AbortController();
      activeController = controller;
      publish({ category, rows: [], loading: true, error: '' });
      const aborted = new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(new Error('La carga del catálogo fue cancelada.')), { once: true });
      });
      try {
        const request = Promise.resolve().then(() => fetchCategory(category, { signal: controller.signal }));
        const timeout = new Promise((_, reject) => {
          activeTimeout = setTimeout(() => {
            const error = new Error('La respuesta tardó demasiado. Comprueba tu conexión e inténtalo de nuevo.');
            reject(error);
            controller.abort();
          }, timeoutMs);
        });
        const rows = await Promise.race([request, timeout, aborted]);
        if (current !== generation) return false;
        publish({ category, rows, loading: false, error: '' });
        return true;
      } catch (error) {
        if (current !== generation) return false;
        publish({ category, rows: [], loading: false, error: error.message || 'No se pudo cargar el catálogo. Inténtalo de nuevo.' });
        return false;
      } finally {
        if (activeController === controller) cancelActive();
      }
    },
    invalidate() {
      cancelActive();
      generation += 1;
    },
  };
}
