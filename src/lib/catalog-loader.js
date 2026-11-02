// Keep each catalog response tied to the category that requested it. A later
// category change invalidates pending work before React runs its next effect.
export function createCatalogLoader(fetchCategory, publish) {
  let generation = 0;
  return {
    reset(category) {
      generation += 1;
      publish({ category, rows: [], loading: true, error: '' });
    },
    async load(category) {
      const current = ++generation;
      publish({ category, rows: [], loading: true, error: '' });
      try {
        const rows = await fetchCategory(category);
        if (current !== generation) return false;
        publish({ category, rows, loading: false, error: '' });
        return true;
      } catch (error) {
        if (current !== generation) return false;
        publish({ category, rows: [], loading: false, error: error.message || 'No se pudo cargar el catálogo' });
        return false;
      }
    },
    invalidate() {
      generation += 1;
    },
  };
}
