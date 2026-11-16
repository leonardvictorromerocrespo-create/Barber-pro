// Real Supabase Auth and PostgREST against PostgreSQL on a disposable GitHub runner.
// No Docker, production credentials, hosted project, or real user data are used.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import http from 'node:http';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { createMeryoApi } from '../src/lib/meryo-api.js';

if (process.env.GITHUB_ACTIONS !== 'true' || process.platform !== 'linux' || !process.env.RUNNER_TEMP) {
  throw new Error('This verification is limited to a disposable GitHub Linux runner');
}

const root = path.join(process.env.RUNNER_TEMP, 'meryo-official');
const database = 'meryo_ci_storage';
const runnerUser = process.env.USER;
const password = crypto.randomBytes(32).toString('base64url');
const jwtSecret = crypto.randomBytes(48).toString('hex');
const logs = [];
const children = [];
const clients = [];
const shops = [];
const users = [];
let proxy;
let phase = 'schema migrations';
let proof;
const db = new pg.Client({ host: '/var/run/postgresql', port: 55440, user: runnerUser, database });

function launch(binary, args, env, label) {
  const output = path.join(process.env.RUNNER_TEMP, `meryo-${label}.log`);
  const stream = createWriteStream(output);
  logs.push(output);
  const child = spawn(binary, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(stream);
  child.stderr.pipe(stream);
  children.push(child);
  return child;
}

async function healthy(url, child) {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Official service exited: ${path.basename(child.spawnfile)}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error('Official Supabase service did not become healthy');
}

function makeClient() {
  const client = createClient('http://127.0.0.1:5178/__supabase', anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  clients.push(client);
  return client;
}

const anonKey = (() => {
  const body = Buffer.from(JSON.stringify({
    role: 'anon', aud: 'authenticated', iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const unsigned = `${header}.${body}`;
  return `${unsigned}.${crypto.createHmac('sha256', jwtSecret).update(unsigned).digest('base64url')}`;
})();

function redact(value) {
  return String(value)
    .replaceAll(password, '[redacted]')
    .replaceAll(jwtSecret, '[redacted]')
    .replaceAll(anonKey, '[redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted-jwt]')
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '[redacted-database-url]');
}

async function signup(client, label) {
  const result = await client.auth.signUp({
    email: `${label}.${crypto.randomUUID()}@example.com`,
    password: crypto.randomBytes(24).toString('base64url'),
    options: { data: { full_name: `Cuenta sintética ${label}` } },
  });
  assert.ifError(result.error);
  assert.ok(result.data.session, 'Local GoTrue confirms synthetic signup and issues a real session');
  users.push(result.data.user.id);
  return result.data.user.id;
}

try {
  console.log('::add-mask::' + password);
  console.log('::add-mask::' + jwtSecret);
  console.log('::add-mask::' + anonKey);
  await db.connect();

  const schema = await fs.readFile('db/reference/storage-ci/schema.sql', 'utf8');
  const metadata = JSON.parse(await fs.readFile('db/reference/storage-ci/system-metadata.json', 'utf8'));
  assert.equal(crypto.createHash('sha256').update(schema).digest('hex'), metadata.sha256, 'Sanitized schema reference must match its recorded hash');
  const rolePassword = (await db.query("select format('alter role %I password %L',$1::text,$2::text) sql", [runnerUser, password])).rows[0].sql;
  await db.query(rolePassword);
  await db.query('alter role service_role bypassrls');
  for (const migration of ['031_barber_catalog_highlights.sql', '032_beauty_catalog_likes.sql', '036_beauty_featured_campaigns.sql']) {
    await db.query(await fs.readFile(`db/incremental/${migration}`, 'utf8'));
  }
  assert.equal((await db.query("select to_regclass('meryo_private.beauty_featured_campaigns') is not null and to_regprocedure('public.meryo_catalog_highlights(text)') is not null as ready")).rows[0].ready, true);

  const connectionUrl = `postgresql://${encodeURIComponent(runnerUser)}:${encodeURIComponent(password)}@127.0.0.1:55440/${database}?sslmode=disable`;
  const authUrl = `${connectionUrl}&options=${encodeURIComponent('-c search_path=auth,public')}`;
  const auth = launch(path.join(root, 'gotrue'), [], {
    GOTRUE_DB_DRIVER: 'postgres', GOTRUE_DB_DATABASE_URL: authUrl, DATABASE_URL: authUrl,
    GOTRUE_DB_NAMESPACE: 'auth', DB_NAMESPACE: 'auth', GOTRUE_API_HOST: '127.0.0.1', PORT: '55441',
    API_EXTERNAL_URL: 'http://127.0.0.1:5178/__supabase/auth/v1', GOTRUE_SITE_URL: 'http://127.0.0.1:5178',
    GOTRUE_JWT_SECRET: jwtSecret, GOTRUE_JWT_AUD: 'authenticated', GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated',
    GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true', GOTRUE_MAILER_AUTOCONFIRM: 'true', GOTRUE_DISABLE_SIGNUP: 'false',
    GOTRUE_DB_MAX_POOL_SIZE: '3', LOG_LEVEL: 'warn', GOMAXPROCS: '2', GOMEMLIMIT: '192MiB',
  }, 'catalog-auth');
  await healthy('http://127.0.0.1:55441/health', auth);

  const rest = launch(path.join(root, 'postgrest'), [], {
    PGRST_DB_URI: connectionUrl, PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon',
    PGRST_JWT_SECRET: jwtSecret, PGRST_JWT_AUD: 'authenticated', PGRST_SERVER_HOST: '127.0.0.1',
    PGRST_SERVER_PORT: '55442', PGRST_DB_POOL: '3', PGRST_LOG_LEVEL: 'error',
  }, 'catalog-rest');
  await healthy('http://127.0.0.1:55442/', rest);

  proxy = http.createServer((request, response) => {
    const route = [['/__supabase/auth/v1', 55441], ['/__supabase/rest/v1', 55442]].find(([prefix]) => request.url.startsWith(prefix));
    if (!route) { response.writeHead(404); response.end(); return; }
    const upstream = http.request({
      hostname: '127.0.0.1', port: route[1], path: request.url.slice(route[0].length) || '/',
      method: request.method, headers: { ...request.headers, host: `127.0.0.1:${route[1]}` },
    }, result => { response.writeHead(result.statusCode, result.headers); result.pipe(response); });
    upstream.on('error', () => { response.writeHead(502); response.end(); });
    request.pipe(upstream);
  });
  await new Promise(resolve => proxy.listen(5178, '127.0.0.1', resolve));

  phase = 'synthetic account and category setup';
  const customer = makeClient();
  const anotherCustomer = makeClient();
  const professional = makeClient();
  const anonymous = makeClient();
  await signup(customer, 'catalog-client');
  const anotherCustomerId = await signup(anotherCustomer, 'catalog-client-two');
  const professionalId = await signup(professional, 'catalog-professional');
  await db.query("update public.profiles set rol='barbero' where id=$1", [professionalId]);

  const seeded = await db.query(`
    insert into public.barberias(nombre,distrito,estado,verificada,tipos_negocio)
    values ('MERYO CI Barbería','Ate','activa',true,array['barberia']::text[]),
           ('MERYO CI Peluquería','Ate','activa',true,array['belleza']::text[]),
           ('MERYO CI Salón Inactivo','Ate','pendiente',false,array['belleza']::text[])
    returning id,nombre`);
  const barberShop = seeded.rows.find(row => row.nombre === 'MERYO CI Barbería').id;
  const beautyShop = seeded.rows.find(row => row.nombre === 'MERYO CI Peluquería').id;
  const inactiveShop = seeded.rows.find(row => row.nombre === 'MERYO CI Salón Inactivo').id;
  shops.push(barberShop, beautyShop, inactiveShop);
  const started = new Date(Date.now() - 60_000).toISOString();
  const ends = new Date(Date.now() + 86_400_000).toISOString();
  await db.query(`insert into meryo_private.barber_featured_campaigns(shop_id,starts_at,ends_at,paid_at,payment_reference)
    values($1,$2,$3,$2,$4)`, [barberShop, started, ends, `ci-barber-${crypto.randomUUID()}`]);
  await db.query(`insert into meryo_private.beauty_featured_campaigns(shop_id,starts_at,ends_at,paid_at,payment_reference)
    values($1,$2,$3,$2,$4)`, [beautyShop, started, ends, `ci-beauty-${crypto.randomUUID()}`]);
  await db.query(`insert into meryo_private.beauty_featured_campaigns(shop_id,starts_at,ends_at,paid_at,payment_reference)
    values($1,$2,$3,$2,$4)`, [inactiveShop, started, ends, `ci-inactive-${crypto.randomUUID()}`]);
  await assert.rejects(db.query(`insert into meryo_private.beauty_featured_campaigns(shop_id,starts_at,ends_at,paid_at,payment_reference)
    values($1,$2,$3,$2,$4)`, [barberShop, started, ends, `ci-wrong-category-${crypto.randomUUID()}`]), error => error.code === '22023');

  phase = 'public highlights, likes, and category isolation through official PostgREST';
  const customerApi = createMeryoApi(customer);
  const secondCustomerApi = createMeryoApi(anotherCustomer);
  const professionalApi = createMeryoApi(professional);
  const publicApi = createMeryoApi(anonymous);
  const beautyRows = await publicApi.catalogHighlights('belleza');
  const barberRows = await publicApi.catalogHighlights('barberia');
  const beautyFeature = beautyRows.find(row => String(row.shop_id) === String(beautyShop));
  const barberFeature = barberRows.find(row => String(row.shop_id) === String(barberShop));
  assert.ok(beautyFeature?.featured, 'A verified synthetic salon with an active paid campaign is highlighted in Peluquerías');
  assert.ok(barberFeature?.featured, 'Existing Barbería campaign remains highlighted');
  assert.equal(beautyRows.some(row => String(row.shop_id) === String(barberShop)), false, 'Barbería does not leak into Peluquerías highlights');
  assert.equal(barberRows.some(row => String(row.shop_id) === String(beautyShop)), false, 'Peluquería does not leak into Barbería highlights');
  assert.equal(beautyRows.some(row => String(row.shop_id) === String(inactiveShop)), false, 'Inactive salons do not appear');
  assert.equal((await customerApi.catalogHighlights('belleza')).find(row => String(row.shop_id) === String(beautyShop)).liked, false);

  await customerApi.setCatalogLike(beautyShop, true, 'belleza');
  const beautyLiked = (await customerApi.catalogHighlights('belleza')).find(row => String(row.shop_id) === String(beautyShop));
  const anotherCustomerView = (await secondCustomerApi.catalogHighlights('belleza')).find(row => String(row.shop_id) === String(beautyShop));
  assert.equal(beautyLiked.likes, 1, 'Beauty like count increments through the app API');
  assert.equal(beautyLiked.liked, true, 'Customer sees their own Beauty like state');
  assert.equal(anotherCustomerView.liked, false, 'Like state is scoped to the signed-in customer');
  await customerApi.setCatalogLike(beautyShop, false, 'belleza');
  const beautyUnliked = (await customerApi.catalogHighlights('belleza')).find(row => String(row.shop_id) === String(beautyShop));
  assert.equal(beautyUnliked.likes, 0, 'Removing the Beauty like decrements count');
  assert.equal(beautyUnliked.liked, false, 'Removing the Beauty like clears customer state');
  await assert.rejects(customerApi.setCatalogLike(beautyShop, true, 'barberia'), /Negocio no disponible/);
  await assert.rejects(professionalApi.setCatalogLike(beautyShop, true, 'belleza'), /Inicia sesión como cliente/);
  await assert.rejects(publicApi.setCatalogLike(beautyShop, true, 'belleza'), /permission denied for function meryo_set_catalog_like|Inicia sesión como cliente/);

  await customerApi.setBarberLike(barberShop, true);
  const barberLiked = (await customerApi.barberHighlights()).find(row => String(row.shop_id) === String(barberShop));
  assert.equal(barberLiked.likes, 1, 'Existing Barbería like count still increments');
  assert.equal(barberLiked.liked, true, 'Existing Barbería like state still belongs to its customer');
  assert.equal((await secondCustomerApi.barberHighlights()).find(row => String(row.shop_id) === String(barberShop)).liked, false);
  await customerApi.setBarberLike(barberShop, false);
  const barberUnliked = (await customerApi.barberHighlights()).find(row => String(row.shop_id) === String(barberShop));
  assert.equal(barberUnliked.likes, 0, 'Existing Barbería unlike still decrements count');
  assert.equal(barberUnliked.featured, true, 'Removing a like does not remove the paid Barbería highlight');

  const acl = (await db.query(`select
    not has_table_privilege('anon','meryo_private.beauty_featured_campaigns','select')
      and not has_table_privilege('authenticated','meryo_private.beauty_featured_campaigns','insert')
      and not has_table_privilege('service_role','meryo_private.beauty_featured_campaigns','insert')
      and not has_function_privilege('anon','meryo_private.require_beauty_featured_shop()','execute')
      and has_function_privilege('anon','public.meryo_catalog_highlights(text)','execute')
      and has_function_privilege('authenticated','public.meryo_set_catalog_like(bigint,boolean,text)','execute') as ok`)).rows[0].ok;
  assert.equal(acl, true, 'Campaign data and trigger stay private while public read and authenticated like RPCs are granted');
  const oldBarber = await customerApi.barberHighlights();
  assert.ok(oldBarber.some(row => String(row.shop_id) === String(barberShop) && row.featured), 'Legacy Barbería highlights RPC still returns its campaign');
  assert.equal(oldBarber.some(row => String(row.shop_id) === String(beautyShop)), false, 'Legacy Barbería RPC remains category-exclusive');

  proof = {
    verifiedAt: new Date().toISOString(),
    environment: 'ephemeral GitHub runner, native PostgreSQL 17, official Supabase Auth and PostgREST',
    dockerUsed: false, productionAccess: false, syntheticAccountsOnly: true,
    prerequisitesApplied: ['021_product_pickup_store.sql', '022_beauty_business_catalog.sql', '023_cut50_campaigns.sql', '024_beauty_service_promotions.sql', '025_weekly_business_promotions.sql', '026_turn_finder_price_check.sql', '027_inspiration_publications.sql', '028_no_show_guard.sql', '029_booking_origins.sql', '031_barber_catalog_highlights.sql', '032_beauty_catalog_likes.sql', '036_beauty_featured_campaigns.sql'],
    beautyPromotedCampaignVisible: true, barberCampaignStillVisible: true,
    categoryIsolationVerified: true, inactiveSalonExcluded: true, wrongCategoryCampaignRejected: true,
    beautyLikeAddRemoveAndCount: true, perCustomerLikeState: true,
    nonCustomerLikeRejected: true, anonymousLikeRejected: true, apiPermissionsVerified: true,
    legacyBarberRpcPreserved: true,
  };
  await fs.writeFile(path.join(process.env.RUNNER_TEMP, 'meryo-catalog-highlights-proof.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
} catch (error) {
  const failure = `Isolated catalog verification failed during ${phase}: ${redact(error.stack || error.message)}`;
  console.error(failure);
  for (const file of logs) {
    const contents = redact(await fs.readFile(file, 'utf8').catch(() => ''));
    console.error(`${path.basename(file)}\n${contents.slice(-6000)}`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `### Isolated catalog test failure\n\n\`\`\`text\n${failure}\n\`\`\`\n`);
  }
  process.exitCode = 1;
} finally {
  if (shops.length) await db.query('delete from public.barberias where id=any($1::bigint[])', [shops]).catch(() => {});
  if (users.length) await db.query('delete from auth.users where id=any($1::uuid[])', [users]).catch(() => {});
  for (const client of clients) await client.auth.signOut({ scope: 'local' }).catch(() => {});
  if (proxy) await new Promise(resolve => proxy.close(resolve));
  for (const child of children) child.kill();
  await db.end().catch(() => {});
}
