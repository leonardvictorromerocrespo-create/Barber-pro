import { bookingLinkIntent, taggedBookingUrl } from '../src/lib/booking-origin.js';
import {
  businessSlug,
  businessIsIndexable,
  catalogIsPublic,
  publicSiteOrigin,
  readPublicCatalog,
  renderPublicShopHtml,
  shopUrl,
  templateHtml,
} from './_public-business.js';

function sendHtml(req, res, status, html, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  Object.entries(headers).forEach(([name, value]) => res.setHeader(name, value));
  res.end(req.method === 'HEAD' ? undefined : html);
}

function errorHtml(title, message) {
  return `<!doctype html><html lang="es-PE"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>${title} | MERYO</title><style>body{margin:0;background:#0b0b0b;color:#f6f3ed;font:16px system-ui;min-height:100vh;display:grid;place-items:center}main{max-width:640px;padding:32px;text-align:center}a{color:#D4AF37}</style></head><body><main><h1>${title}</h1><p>${message}</p><a href="/?catalogo=barberia#client">Volver a MERYO</a></main></body></html>`;
}

export default async function publicShop(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return sendHtml(req, res, 405, errorHtml('Método no permitido', 'Abre el enlace público desde el navegador.'));
  }

  const id = String(req.query?.id ?? '');
  if (!/^\d{1,19}$/.test(id)) {
    return sendHtml(req, res, 404, errorHtml('Negocio no encontrado', 'Este perfil no está disponible.'), { 'X-Robots-Tag': 'noindex, follow' });
  }

  const explicitCategory = req.query?.catalogo === 'barberia' || req.query?.catalogo === 'belleza'
    ? req.query.catalogo : null;
  try {
    let category = explicitCategory || 'barberia';
    let catalog = await readPublicCatalog(category);
    let shop = catalog.find(row => String(row.id) === id && catalogIsPublic(row));
    if (!explicitCategory && !shop) {
      category = 'belleza';
      catalog = await readPublicCatalog(category);
      shop = catalog.find(row => String(row.id) === id && catalogIsPublic(row));
    }
    if (!shop) {
      return sendHtml(req, res, 404, errorHtml('Negocio no encontrado', 'Este negocio no está publicado o ya no se encuentra disponible.'), { 'X-Robots-Tag': 'noindex, follow' });
    }

    const origin = publicSiteOrigin();
    const expectedSlug = businessSlug(shop.nombre);
    const requestedSlug = String(req.query?.slug ?? '');
    const shouldAddBeautyCategory = !explicitCategory && category === 'belleza';
    if (requestedSlug !== expectedSlug || shouldAddBeautyCategory) {
      const redirectCategory = explicitCategory || category;
      res.statusCode = 308;
      const profile={ id: shop.id, name: shop.nombre };
      const intent=bookingLinkIntent('/negocio/'+id,new URLSearchParams({
        reservar:String(req.query?.reservar??''),origen:String(req.query?.origen??''),
      }));
      res.setHeader('Location', intent
        ? taggedBookingUrl(profile,redirectCategory,intent.source,origin)
        : shopUrl(profile,redirectCategory,origin));
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.end();
    }

    const template = templateHtml();
    const html = renderPublicShopHtml({ shop, category, catalog, template, origin });
    return sendHtml(req, res, 200, html, { 'X-Robots-Tag': businessIsIndexable(shop) ? 'index, follow' : 'noindex, follow' });
  } catch {
    return sendHtml(req, res, 503, errorHtml('MERYO no está disponible temporalmente', 'No pudimos cargar este perfil. Inténtalo de nuevo en unos minutos.'), { 'Retry-After': '30', 'X-Robots-Tag': 'noindex, follow' });
  }
}
