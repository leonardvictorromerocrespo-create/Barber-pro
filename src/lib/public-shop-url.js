const PUBLIC_ORIGIN = 'https://barber-pro-phi-taupe.vercel.app';
const NON_INDEXABLE_PUBLIC_SHOP_IDS = new Set(['11']);

export function isPublicShopIndexable(shop) {
  return Boolean(shop && !NON_INDEXABLE_PUBLIC_SHOP_IDS.has(String(shop.id)));
}

export function publicShopSlug(name) {
  return String(name || 'negocio')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'negocio';
}

export function publicShopPath(shop) {
  return `/negocio/${encodeURIComponent(String(shop?.id ?? ''))}/${publicShopSlug(shop?.name ?? shop?.nombre)}`;
}

export function publicShopUrl(shop, category = 'barberia', origin = PUBLIC_ORIGIN) {
  const url = new URL(publicShopPath(shop), origin);
  if (category === 'belleza') url.searchParams.set('catalogo', 'belleza');
  return url.href;
}

export function publicShopCanonical(shop, origin = PUBLIC_ORIGIN) {
  const types = shop?.businessTypes ?? shop?.tipos_negocio ?? ['barberia'];
  const category = Array.isArray(types) && types.includes('barberia') ? 'barberia' : 'belleza';
  return publicShopUrl(shop, category, origin);
}

export function publicShopIdFromPath(pathname) {
  const match = String(pathname || '').match(/^\/negocio\/(\d+)(?:\/[^/]+)?\/?$/);
  return match?.[1] ?? null;
}

export function isPublicShopPath(pathname) {
  return publicShopIdFromPath(pathname) !== null;
}
