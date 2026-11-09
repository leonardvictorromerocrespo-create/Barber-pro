import { publicShopIdFromPath, publicShopUrl } from './public-shop-url.js';

export const bookingOriginLabels = Object.freeze({
  ficha_google: 'Ficha de Google',
  turnos_hoy: 'Turnos para hoy',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  desconocido: 'Origen desconocido',
});

const external = ['ficha_google', 'whatsapp', 'instagram'];
export const normalizeBookingOrigin = value =>
  external.includes(value) || value === 'turnos_hoy' ? value : null;

export function bookingLinkIntent(pathname, search) {
  const shopId = publicShopIdFromPath(pathname);
  if (!shopId) return null;
  const params = new URLSearchParams(search);
  if (params.get('reservar') !== '1') return null;
  const source = params.get('origen');
  return { shopId, source: external.includes(source) ? source : null };
}

export function taggedBookingUrl(shop, category, source, origin) {
  const url = new URL(publicShopUrl(shop, category, origin));
  url.searchParams.set('reservar', '1');
  if (external.includes(source)) url.searchParams.set('origen', source);
  return url.href;
}
