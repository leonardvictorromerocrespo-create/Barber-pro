import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import {
  businessStructuredData,
  businessIsIndexable,
  catalogIsPublic,
  publicBusinessDescription,
  renderPublicShopHtml,
  sitemapXml,
} from '../api/_public-business.js';
import publicShopHandler from '../api/public-shop.js';
import sitemapHandler from '../api/sitemap.js';
import { publicShopIdFromPath, publicShopUrl } from '../src/lib/public-shop-url.js';

const origin='https://barber-pro-phi-taupe.vercel.app';
const barber={id:42,nombre:'Barbería Áurea',tipos_negocio:['barberia'],verificada:true,estado:'activa',descripcion:'Cortes y cuidado en Ate.',direccion:'Av. Central 120',distrito:'Ate Vitarte',lat:-12.05,lng:-76.92,imagen_url:'https://cdn.example.test/aurea.jpg',servicios:[{id:2,nombre:'Corte',precio:35,duracion_min:45,activo:true}]};
const beauty={...barber,id:77,nombre:'Salón Serena',tipos_negocio:['belleza'],distrito:'Miraflores'};
const testShop={...barber,id:11,nombre:'Barberiashoppi'};

function responseRecorder(){
  return {headers:{},statusCode:200,setHeader(key,value){this.headers[key.toLowerCase()]=value;},end(body){this.body=body;}};
}

function withCatalogFetch(rowsByCategory, run){
  const originalFetch=globalThis.fetch;
  const originalEnv={...process.env};
  process.env.MERYO_SUPABASE_URL='https://supabase.example.test';
  process.env.MERYO_SUPABASE_ANON_KEY='public-test-key';
  globalThis.fetch=async(url,options)=>{
    if(!String(url).startsWith('https://supabase.example.test/'))return originalFetch(url,options);
    assert.match(String(url),/\/rest\/v1\/rpc\/meryo_catalogo_categoria$/);
    assert.equal(options.headers.apikey,'public-test-key');
    assert.equal(options.headers.authorization,'Bearer public-test-key');
    const {p_categoria}=JSON.parse(options.body);
    return new Response(JSON.stringify(rowsByCategory[p_categoria]||[]),{status:200,headers:{'content-type':'application/json'}});
  };
  return Promise.resolve().then(run).finally(()=>{
    globalThis.fetch=originalFetch;
    for(const key of Object.keys(process.env))if(!(key in originalEnv))delete process.env[key];
    for(const [key,value] of Object.entries(originalEnv))process.env[key]=value;
  });
}

test('public profiles create stable category-aware links and use escaped real fields',()=>{
  assert.equal(publicBusinessDescription(barber),barber.descripcion);
  assert.equal(publicShopUrl(beauty,'belleza',origin),'https://barber-pro-phi-taupe.vercel.app/negocio/77/salon-serena?catalogo=belleza');
  assert.equal(publicShopIdFromPath('/negocio/77/salon-serena'),'77');
  assert.equal(publicShopIdFromPath('/negocio/no-es-id/salon-serena'),null);
  assert.equal(catalogIsPublic(barber),true);
  assert.equal(businessIsIndexable(testShop),false);
  assert.equal(businessIsIndexable(barber),true);
  assert.equal(catalogIsPublic({...barber,estado:'pendiente'}),false);
  assert.equal(catalogIsPublic({...barber,demo:true}),false);
  assert.match(sitemapXml([barber,beauty,barber],origin),/<loc>https:\/\/barber-pro-phi-taupe\.vercel\.app\/negocio\/42\/barberia-aurea<\/loc>/);
  assert.match(sitemapXml([barber,beauty],origin),/<loc>https:\/\/barber-pro-phi-taupe\.vercel\.app\/negocio\/77\/salon-serena\?catalogo=belleza<\/loc>/);
  assert.equal((sitemapXml([barber,beauty,barber,testShop],origin).match(/<url>/g)||[]).length,2);
  assert.doesNotMatch(sitemapXml([barber,beauty,testShop],origin),/barberiashoppi|\/negocio\/11\//);
  const structured=businessStructuredData(barber,'https://example.test/profile',origin);
  assert.equal(structured['@type'],'LocalBusiness');
  assert.equal(structured.aggregateRating,undefined);
  assert.equal(structured.geo.latitude,barber.lat);
  const xss={...barber,nombre:'<script>alert(1)</script>',descripcion:'<img src=x onerror=alert(1)>'};
  const html=renderPublicShopHtml({shop:xss,category:'barberia',catalog:[barber],template:'<!doctype html><html lang="en"><head><title>MERYO</title></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>',origin});
  assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/);
  assert.match(html,/rel="canonical" href="https:\/\/barber-pro-phi-taupe\.vercel\.app\/negocio\/42\/script-alert-1-script/);
  assert.match(html,/property="og:title"/);
  assert.match(html,/application\/ld\+json/);
  assert.doesNotMatch(html,/aggregateRating|ratingValue|reviewCount/);
  assert.ok(html.indexOf('Barbería &lt;script') < html.indexOf('src="/assets/app.js"'));
  assert.match(html,/id="public-shop-prerender"/);
  assert.match(html,/id="root"><\/div>/);
});

test('real local HTTP routing serves business HTML, redirects retired slugs, and returns sitemap XML',async()=>withCatalogFetch({barberia:[barber],belleza:[beauty]},async()=>{
  const server=createServer((req,res)=>{
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/sitemap.xml'){sitemapHandler(req,res);return;}
    const match=url.pathname.match(/^\/negocio\/(\d+)\/([^/]+)\/?$/);
    if(match){req.query={id:match[1],slug:decodeURIComponent(match[2]),catalogo:url.searchParams.get('catalogo')};publicShopHandler(req,res);return;}
    res.statusCode=404;res.end();
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const address=server.address(),base=`http://127.0.0.1:${address.port}`;
    const profile=await fetch(`${base}/negocio/42/barberia-aurea`);
    assert.equal(profile.status,200);
    assert.match(profile.headers.get('content-type'),/text\/html/);
    assert.match(await profile.text(),/og:title/);
    const stale=await fetch(`${base}/negocio/42/nombre-antiguo`,{redirect:'manual'});
    assert.equal(stale.status,308);
    const sitemap=await fetch(`${base}/sitemap.xml`);
    assert.equal(sitemap.status,200);
    assert.match(sitemap.headers.get('content-type'),/application\/xml/);
    assert.equal((await sitemap.text()).match(/<url>/g)?.length,2);
  }finally{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
}));

test('direct beauty profile resolves before JavaScript; stale slug redirects to the current name',async()=>withCatalogFetch({barberia:[],belleza:[beauty]},async()=>{
  const response=responseRecorder();
  await publicShopHandler({method:'GET',query:{id:'77',slug:'salon-serena',catalogo:'belleza'}},response);
  assert.equal(response.statusCode,200);
  assert.match(response.body,/<title>Salón Serena \| Peluquería y salón en MERYO<\/title>/);
  assert.match(response.body,/rel="canonical" href="https:\/\/barber-pro-phi-taupe\.vercel\.app\/negocio\/77\/salon-serena\?catalogo=belleza"/);
  assert.match(response.body,/Cortes y cuidado en Ate\./);
  assert.match(response.body,/<script type="module" crossorigin src="\/assets\/index-[^"]+\.js"><\/script>/);
  assert.match(response.body,/<link rel="stylesheet" crossorigin href="\/assets\/index-[^"]+\.css">/);
  assert.ok(response.body.indexOf('Salón Serena')<response.body.indexOf('/assets/index-'));
  assert.ok(response.headers['x-robots-tag'].includes('index'));
  const stale=responseRecorder();
  await publicShopHandler({method:'GET',query:{id:'77',slug:'nombre-antiguo',catalogo:'belleza'}},stale);
  assert.equal(stale.statusCode,308);
  assert.equal(stale.headers.location,'https://barber-pro-phi-taupe.vercel.app/negocio/77/salon-serena?catalogo=belleza');
}));

test('robots, Google verification file, and Vercel routes expose only public business URLs',()=>{
  const robots=readFileSync(new URL('../public/robots.txt',import.meta.url),'utf8');
  assert.match(robots,/Allow: \/negocio\//);
  assert.match(robots,/Disallow: \/\*\?admin_view=/);
  assert.match(robots,/Disallow: \/api\//);
  assert.match(robots,/Sitemap: https:\/\/barber-pro-phi-taupe\.vercel\.app\/sitemap\.xml/);
  assert.equal(readFileSync(new URL('../public/google5e252d37f97909bb.html',import.meta.url),'utf8'),'google-site-verification: google5e252d37f97909bb.html');
  const vercel=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.ok(vercel.rewrites.some(rule=>rule.source==='/negocio/:id/:slug'&&rule.destination==='/api/public-shop'));
  assert.ok(vercel.rewrites.some(rule=>rule.source==='/sitemap.xml'&&rule.destination==='/api/sitemap'));
  assert.equal(vercel.functions['api/public-shop.js'].includeFiles,'dist/index.html');
});

test('unknown or non-public profiles return noindex 404 without old business content',async()=>withCatalogFetch({barberia:[{...barber,estado:'pendiente'}],belleza:[]},async()=>{
  const response=responseRecorder();
  await publicShopHandler({method:'GET',query:{id:'42',slug:'barberia-aurea',catalogo:'barberia'}},response);
  assert.equal(response.statusCode,404);
  assert.ok(response.headers['x-robots-tag'].includes('noindex'));
  assert.doesNotMatch(response.body,/Barbería Áurea/);
}));

test('confirmed test business remains publicly available but is noindex and absent from sitemap',async()=>withCatalogFetch({barberia:[testShop],belleza:[]},async()=>{
  const response=responseRecorder();
  await publicShopHandler({method:'GET',query:{id:'11',slug:'barberiashoppi'}},response);
  assert.equal(response.statusCode,200);
  assert.match(response.body,/<title>Barberiashoppi \| Barbería en MERYO<\/title>/);
  assert.match(response.body,/<meta name="robots" content="noindex, follow">/);
  assert.equal(response.headers['x-robots-tag'],'noindex, follow');
  assert.match(response.body,/<h1>Barberiashoppi<\/h1>/);
  assert.doesNotMatch(sitemapXml([testShop],origin),/barberiashoppi|\/negocio\/11\//);
}));

test('sitemap is generated from active public catalogs and excludes duplicates and pending records',async()=>withCatalogFetch({barberia:[barber],belleza:[beauty,barber,{...beauty,id:88,nombre:'Pendiente',estado:'pendiente'}]},async()=>{
  const response=responseRecorder();
  await sitemapHandler({method:'GET',query:{}},response);
  assert.equal(response.statusCode,200);
  assert.equal(response.headers['content-type'],'application/xml; charset=utf-8');
  assert.equal((response.body.match(/<url>/g)||[]).length,2);
  assert.match(response.body,/barberia-aurea/);
  assert.match(response.body,/salon-serena\?catalogo=belleza/);
  assert.doesNotMatch(response.body,/Pendiente/);
}));
