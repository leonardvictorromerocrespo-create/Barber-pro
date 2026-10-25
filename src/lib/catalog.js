// Adapted from the ZIP's Home/format modules. Pure presentation logic; no SQL.
export function coordinates(point) {
  if (point?.lat == null || point?.lng == null || point.lat === '' || point.lng === '') return null;
  const lat = Number(point.lat), lng = Number(point.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

export function distanciaKm(a, b) {
  const start = coordinates(a), end = coordinates(b);
  if (!start || !end) return null;
  const rad = value => value * Math.PI / 180;
  const h = Math.sin(rad(end.lat - start.lat) / 2) ** 2 + Math.cos(rad(start.lat)) * Math.cos(rad(end.lat)) * Math.sin(rad(end.lng - start.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-PE').trim();
const price = value => value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : Infinity;
export function selectShops(shops, { query = '', district = '', order = 'rating', location = null } = {}) {
  const text = normalize(query);
  return shops.filter(shop => (!district || normalize(shop.district) === normalize(district)) && normalize(`${shop.name} ${shop.district}`).includes(text))
    .map(shop => ({ ...shop, km: distanciaKm(location, shop) }))
    .sort((a, b) => {
      if (order === 'distance' && coordinates(location)) return (a.km ?? Infinity) - (b.km ?? Infinity);
      if (order === 'price') return price(a.basePrice) - price(b.basePrice);
      return (Number(b.rating) || 0) - (Number(a.rating) || 0) || (Number(b.reviews) || 0) - (Number(a.reviews) || 0);
    });
}

export function catalogMarkers(shops) {
  return shops.filter(shop => coordinates(shop)).map(shop => ({ ...coordinates(shop), id: shop.id, title: shop.name, detail: shop.district }));
}
