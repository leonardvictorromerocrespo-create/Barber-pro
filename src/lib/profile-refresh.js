function mergeFreshProfile(current, fresh) {
  return {
    ...current,
    ...fresh,
    assets: current.assets ?? fresh.assets ?? [],
    coverImage: current.coverImage ?? fresh.coverImage ?? '',
    image: current.image ?? fresh.image ?? '',
    profileImage: current.profileImage ?? fresh.profileImage ?? null,
    contentError: current.contentError ?? fresh.contentError ?? '',
  };
}

export function createProfileRefreshCoordinator({ fetchCatalog, setSelectedShop, setCatalogState }) {
  let generation = 0;

  return {
    invalidate() {
      generation += 1;
    },
    async refresh(shop, category) {
      const request = ++generation;
      const shopId = String(shop.id);
      try {
        const rows = await fetchCatalog(category, shopId);
        if (request !== generation) return false;
        const freshShop = rows.find(row => String(row.id) === shopId);
        if (!freshShop) return false;

        setSelectedShop(current => current && String(current.id) === shopId
          ? mergeFreshProfile(current, freshShop)
          : current);
        setCatalogState(current => current.category === category
          ? { ...current, rows: current.rows.map(row => String(row.id) === shopId ? freshShop : row) }
          : current);
        return true;
      } catch {
        return false;
      }
    },
  };
}
