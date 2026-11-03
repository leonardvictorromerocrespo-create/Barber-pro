import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isPublicShopIndexable, publicShopCanonical, publicShopPath, publicShopSlug, publicShopUrl } from '../src/lib/public-shop-url.js';

const SITE_ORIGIN = 'https://barber-pro-phi-taupe.vercel.app';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

export function catalogIsPublic(row) {
  return Boolean(row && row.demo !== true && row.publicable !== false && row.privado !== true
    && row.verificada === true && row.estado === 'activa' && Array.isArray(row.tipos_negocio)
    && row.tipos_negocio.some(type => type === 'barberia' || type === 'belleza'));
}

export function businessIsIndexable(row) {
  return isPublicShopIndexable(row);
}

export function publicBusinessDescription(shop) {
  const description = String(shop.descripcion ?? '').replace(/\s+/g, ' ').trim();
  if (description) return description.slice(0, 180);
  const category = Array.isArray(shop.tipos_negocio) && !shop.tipos_negocio.includes('barberia') ? 'salón' : 'barbería';
  const district = String(shop.distrito ?? '').trim();
  return `Conoce ${shop.nombre}, ${category}${district ? ` en ${district}` : ''}, y consulta sus servicios en MERYO.`.slice(0, 180);
}

function safePublicUrl(value, origin) {
  if (!value) return '';
  try {
    const url = new URL(String(value), origin);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) return '';
    return url.href;
  } catch {
    return '';
  }
}

export function businessStructuredData(shop, canonical, origin = SITE_ORIGIN) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: String(shop.nombre ?? ''),
    url: canonical,
  };
  const description = publicBusinessDescription(shop);
  if (description) data.description = description;
  const image = safePublicUrl(shop.imagen_url, origin);
  if (image) data.image = image;
  const address = {};
  if (shop.direccion) address.streetAddress = String(shop.direccion);
  if (shop.distrito) address.addressLocality = String(shop.distrito);
  if (Object.keys(address).length) {
    address.addressCountry = 'PE';
    data.address = { '@type': 'PostalAddress', ...address };
  }
  const latitude = Number(shop.lat), longitude = Number(shop.lng);
  if (shop.lat != null && shop.lng != null && Number.isFinite(latitude) && Number.isFinite(longitude)
      && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
    data.geo = { '@type': 'GeoCoordinates', latitude, longitude };
  }
  return data;
}

function formatPrice(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0
    ? new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 2 }).format(amount)
    : '';
}

function renderService(service) {
  if (!service || service.activo === false) return '';
  const name = escapeHtml(service.nombre);
  const evaluation = service.requiere_evaluacion === true;
  const price = evaluation ? 'Requiere evaluación' : formatPrice(service.precio);
  const minutes = Number(service.duracion_min);
  const duration = Number.isInteger(minutes) && minutes > 0 ? `${minutes} min` : '';
  return `<li class="ssr-service"><span>${name}</span><span>${escapeHtml([price, duration].filter(Boolean).join(' · '))}</span></li>`;
}

function renderCatalogCard(shop, category, origin) {
  const url = publicShopUrl({ id: shop.id, name: shop.nombre }, category, origin);
  const image = safePublicUrl(shop.imagen_url, origin);
  return `<a class="ssr-card" href="${escapeHtml(url)}"><span>${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy">` : ''}</span><strong>${escapeHtml(shop.nombre)}</strong><small>${escapeHtml(shop.distrito ?? '')}</small></a>`;
}

function renderProfile(shop, category, catalog, origin) {
  const name = escapeHtml(shop.nombre);
  const description = escapeHtml(publicBusinessDescription(shop));
  const address = escapeHtml([shop.direccion, shop.distrito].filter(Boolean).join(' · '));
  const image = safePublicUrl(shop.imagen_url, origin);
  const services = (Array.isArray(shop.servicios) ? shop.servicios : []).map(renderService).filter(Boolean).join('');
  const typeLabel = category === 'belleza' ? 'salón' : 'barbería';
  const catalogLabel = category === 'belleza' ? 'Peluquerías y salones' : 'Barberías';
  const cards = catalog.filter(catalogIsPublic).slice(0, 12).map(row => renderCatalogCard(row, category, origin)).join('');
  const categoryQuery = category === 'belleza' ? '?catalogo=belleza' : '';

  return `<div class="ssr-page" data-category="${category}">
    <header class="ssr-header"><a href="/${categoryQuery}#client" aria-label="MERYO, volver al catálogo">MER<span>YO</span></a><span>${catalogLabel}</span></header>
    <main class="ssr-catalog"><h2>${catalogLabel} cerca de ti</h2><div class="ssr-grid">${cards}</div></main>
    <div class="ssr-backdrop"><article class="ssr-modal" role="dialog" aria-modal="true" aria-label="Perfil de ${name}">
      <a class="ssr-close" href="/${categoryQuery}#client">Cerrar</a>
      <h1>${name}</h1>
      ${description ? `<p class="ssr-description">${description}</p>` : ''}
      ${image ? `<section><h2>Presentación</h2><img class="ssr-cover" src="${escapeHtml(image)}" alt="Presentación de ${name}"></section>` : ''}
      ${address ? `<section><h2>Ubicación</h2><p>${address}</p></section>` : ''}
      ${services ? `<section><h2>Servicios</h2><ul>${services}</ul></section>` : ''}
      <p class="ssr-category">Perfil público de ${typeLabel} en MERYO</p>
      <a class="ssr-return" href="/${categoryQuery}#client">Volver al catálogo</a>
    </article></div>
  </div>`;
}

function styles(category) {
  const beauty = category === 'belleza';
  const background = beauty ? '#FAF7F4' : '#0b0b0b';
  const surface = beauty ? '#FFFEFC' : '#171717';
  const text = beauty ? '#352832' : '#f6f3ed';
  const muted = beauty ? '#62575f' : '#b5b1a9';
  const accent = beauty ? '#955568' : '#D4AF37';
  return `<style>
    html,body{margin:0;min-height:100%;background:${background};color:${text};font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
    body{overflow-x:hidden}.ssr-page{min-height:100vh}.ssr-header{height:68px;display:flex;align-items:center;justify-content:space-between;padding:0 max(24px,calc((100vw - 1180px)/2));border-bottom:1px solid ${beauty ? '#e5dce0' : '#292929'};font-weight:700}.ssr-header a{color:${text};font-size:24px;text-decoration:none}.ssr-header a span{color:${accent}}.ssr-catalog{max-width:1180px;margin:32px auto;padding:0 24px}.ssr-catalog h2{margin:0 0 18px;font-size:clamp(22px,3vw,32px)}.ssr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:16px}.ssr-card{min-width:0;padding:12px;background:${surface};border:1px solid ${beauty ? '#e5dce0' : '#333'};border-radius:18px;color:${text};text-decoration:none}.ssr-card>span{display:block;height:94px;overflow:hidden;border-radius:12px;background:${beauty ? '#EEDDE2' : '#27231a'}}.ssr-card img{width:100%;height:100%;object-fit:cover}.ssr-card strong,.ssr-card small{display:block;margin-top:9px}.ssr-card small,.ssr-category{color:${muted}}.ssr-backdrop{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.64)}.ssr-modal{position:relative;box-sizing:border-box;width:min(960px,100%);max-height:90vh;overflow:auto;border:1px solid ${beauty ? '#e5dce0' : '#3a352b'};border-radius:28px;padding:28px;background:${surface};color:${text};box-shadow:0 24px 80px rgba(0,0,0,.38)}.ssr-modal h1{max-width:80%;margin:0;font-size:clamp(28px,4vw,42px);line-height:1.1}.ssr-description{max-width:760px;color:${muted};line-height:1.65}.ssr-modal section{margin-top:20px;padding:16px;border:1px solid ${beauty ? '#e5dce0' : '#34312a'};border-radius:18px}.ssr-modal section h2{margin:0 0 12px;color:${accent};font-size:18px}.ssr-modal section p{color:${muted}}.ssr-cover{display:block;max-height:310px;width:100%;object-fit:cover;border-radius:12px}.ssr-modal ul{list-style:none;margin:0;padding:0}.ssr-service{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid ${beauty ? '#eee7e9' : '#34312a'}}.ssr-service:last-child{border:0}.ssr-service span:last-child{color:${accent};text-align:right}.ssr-close{position:absolute;right:22px;top:22px;color:${muted}}.ssr-return{display:inline-flex;margin-top:10px;padding:11px 16px;border:1px solid ${accent};border-radius:12px;color:${text};text-decoration:none}.ssr-category{font-size:13px}@media(max-width:640px){.ssr-header{height:58px;padding:0 16px}.ssr-header span{font-size:12px}.ssr-catalog{margin-top:20px;padding:0 14px}.ssr-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.ssr-card{padding:8px}.ssr-card>span{height:76px}.ssr-card strong{font-size:14px}.ssr-backdrop{padding:8px}.ssr-modal{max-height:94vh;padding:20px 14px;border-radius:20px}.ssr-close{right:14px;top:16px}.ssr-modal h1{max-width:72%;font-size:27px}.ssr-modal section{padding:12px}.ssr-service{font-size:13px}}
  </style>`;
}

export function renderPublicShopHtml({ shop, category, catalog, template, origin = SITE_ORIGIN }) {
  const canonical = publicShopCanonical(shop, origin);
  const titleCategory = category === 'belleza' ? 'Peluquería y salón' : 'Barbería';
  const title = `${shop.nombre} | ${titleCategory} en MERYO`;
  const description = publicBusinessDescription(shop);
  const image = safePublicUrl(shop.imagen_url, origin);
  const json = JSON.stringify(businessStructuredData(shop, canonical, origin))
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  const head = `<meta name="description" content="${escapeHtml(description)}">
    <meta name="robots" content="${businessIsIndexable(shop) ? 'index, follow, max-image-preview:large' : 'noindex, follow'}">
    <link rel="canonical" href="${escapeHtml(canonical)}">
    <meta property="og:type" content="website"><meta property="og:site_name" content="MERYO">
    <meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${escapeHtml(canonical)}">
    ${image ? `<meta property="og:image" content="${escapeHtml(image)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${escapeHtml(image)}">` : '<meta name="twitter:card" content="summary">'}
    <meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}">
    ${styles(category)}<script type="application/ld+json">${json}</script>`;
  const markup = `<div id="public-shop-prerender">${renderProfile(shop, category, catalog, origin)}</div><div id="root"></div>`;
  return template
    .replace(/<html\s+lang="[^"]*"/i, '<html lang="es-PE"')
    .replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace('</head>', `${head}\n  </head>`)
    .replace('<div id="root"></div>', markup);
}

export function publicSiteOrigin() {
  return SITE_ORIGIN;
}

export function canonicalShopUrl(shop, origin = SITE_ORIGIN) {
  return publicShopCanonical(shop, origin);
}

export function shopUrl(shop, category, origin = SITE_ORIGIN) {
  return publicShopUrl(shop, category, origin);
}

export function shopPath(shop) {
  return publicShopPath(shop);
}

export function sitemapXml(rows, origin = SITE_ORIGIN) {
  const shops = new Map();
  for (const row of rows) {
    if (!catalogIsPublic(row) || !businessIsIndexable(row) || !/^\d+$/.test(String(row.id ?? '')) || !String(row.nombre ?? '').trim()) continue;
    shops.set(String(row.id), row);
  }
  const urls = [...shops.values()].map(row => `<url><loc>${escapeHtml(canonicalShopUrl(row, origin))}</loc></url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

export function templateHtml(projectRoot = globalThis.process.cwd()) {
  return readFileSync(join(projectRoot, 'dist', 'index.html'), 'utf8');
}

export function businessSlug(name) {
  return publicShopSlug(name);
}

export async function readPublicCatalog(category, env = globalThis.process.env, fetcher = fetch) {
  const url = env.MERYO_SUPABASE_URL || env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  // Public catalog access intentionally uses only the anon/publishable key. Never use a service-role key here.
  const key = env.MERYO_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY
    || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('public_catalog_not_configured');
  const response = await fetcher(`${String(url).replace(/\/$/, '')}/rest/v1/rpc/meryo_catalogo_categoria`, {
    method: 'POST',
    headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_categoria: category }),
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`public_catalog_http_${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('public_catalog_invalid_response');
  return rows;
}
