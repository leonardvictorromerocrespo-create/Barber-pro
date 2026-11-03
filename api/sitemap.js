import { publicSiteOrigin, readPublicCatalog, sitemapXml } from '../server/public-business.js';

export default async function sitemap(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.statusCode = 405;
    res.end();
    return;
  }
  try {
    const [barberias, belleza] = await Promise.all([
      readPublicCatalog('barberia'),
      readPublicCatalog('belleza'),
    ]);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex, follow');
    // Fetch fresh public RPC results so removed, private, pending, or confirmed demo records are not retained in a cached sitemap.
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.end(req.method === 'HEAD' ? undefined : sitemapXml([...barberias, ...belleza], publicSiteOrigin()));
  } catch {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Retry-After', '30');
    res.end(req.method === 'HEAD' ? undefined : '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>');
  }
}
