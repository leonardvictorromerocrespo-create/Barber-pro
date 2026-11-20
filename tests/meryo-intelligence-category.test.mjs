import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import { createMeryoIntelligenceHandler } from '../api/meryo-intelligence.js';

test('the catalog entry and shared assistant adapt to Barberías and Peluquerías', async () => {
  const appSource = await fs.readFile(path.resolve('src/App.jsx'), 'utf8');
  const componentSource = await fs.readFile(path.resolve('src/components/MeryoIntelligence.jsx'), 'utf8');
  const apiSource = await fs.readFile(path.resolve('api/meryo-intelligence.js'), 'utf8');
  assert.match(appSource, /className="meryo-intelligence-trigger"/);
  assert.match(appSource, /<MeryoIntelligence open category=\{catalogCategory\}/);
  assert.match(appSource, /onOpenShop=\{\(recommendationCategory,shopId\)=>\{if\(recommendationCategory!==catalogCategory\)return/);
  assert.doesNotMatch(componentSource, /import\.meta\.env[^\n]*OPENAI_API_KEY/);
  assert.match(apiSource, /authorization: `Bearer \$\{env\.OPENAI_API_KEY\}`/);
  assert.match(apiSource, /validWorkIds = new Set\(works\.map\(work => work\.id\)\)/);

  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { default: MeryoIntelligence } = await vite.ssrLoadModule('/src/components/MeryoIntelligence.jsx');
    const assistant = category => renderToStaticMarkup(React.createElement(MeryoIntelligence, { open: true, category, onClose() {} }));

    const barberAssistant = assistant('barberia');
    assert.match(barberAssistant, /data-meryo-theme="barberia"/);
    assert.match(barberAssistant, /Quiero un corte fácil de mantener/);
    assert.doesNotMatch(barberAssistant, /Me interesa un cambio de color/);

    const beautyAssistant = assistant('belleza');
    assert.match(beautyAssistant, /data-meryo-theme="beauty"/);
    assert.match(beautyAssistant, /servicio de peluquería/);
    assert.match(beautyAssistant, /Me interesa un cambio de color/);
    assert.doesNotMatch(beautyAssistant, /Quiero un corte fácil de mantener/);
  } finally {
    await vite.close();
  }
});

function responseRecorder() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name] = value; },
    end(body) { this.body = body || ''; },
  };
}

async function call(handler, { method = 'GET', url = '/api/meryo-intelligence', body = {} } = {}) {
  const res = responseRecorder();
  await handler({ method, url, headers: { host: 'localhost' }, body }, res);
  return { status: res.statusCode, payload: JSON.parse(res.body) };
}

test('status endpoint reports the selected category without requesting the model', async () => {
  let outboundCalls = 0;
  const handler = createMeryoIntelligenceHandler({ env: {}, fetcher: async () => { outboundCalls += 1; throw new Error('unexpected network call'); } });

  const barberia = await call(handler, { url: '/api/meryo-intelligence?category=barberia' });
  const belleza = await call(handler, { url: '/api/meryo-intelligence?category=belleza' });
  const unsupported = await call(handler, { url: '/api/meryo-intelligence?category=tienda' });

  const expectedMissing = [
    'OPENAI_API_KEY',
    'OPENAI_MODEL',
    'MERYO_SUPABASE_URL / SUPABASE_URL / VITE_SUPABASE_URL',
    'MERYO_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_ANON_KEY',
  ];
  assert.deepEqual(barberia, { status: 200, payload: { status: 'configuration_pending', configured: false, category: 'barberia', missing: expectedMissing } });
  assert.deepEqual(belleza, { status: 200, payload: { status: 'configuration_pending', configured: false, category: 'belleza', missing: expectedMissing } });
  assert.deepEqual(unsupported, { status: 400, payload: { error: 'category_not_supported' } });
  assert.equal(outboundCalls, 0);
});

test('status endpoint reports only missing variable names and never returns configured values', async () => {
  const secret = 'test-secret-must-not-be-returned';
  const handler = createMeryoIntelligenceHandler({
    env: {
      OPENAI_API_KEY: secret,
      OPENAI_MODEL: 'test-model',
      MERYO_SUPABASE_URL: 'https://catalog.invalid',
      MERYO_SUPABASE_ANON_KEY: 'test-publishable-key',
    },
    fetcher: async () => { throw new Error('GET must not call a provider'); },
  });
  const result = await call(handler, { url: '/api/meryo-intelligence?category=barberia' });
  assert.deepEqual(result, { status: 200, payload: { status: 'ready', configured: true, category: 'barberia', missing: [] } });
  assert.equal(JSON.stringify(result.payload).includes(secret), false);
});

test('missing key, model, or catalog configuration blocks before any external request', async () => {
  let outboundCalls = 0;
  const fetcher = async () => { outboundCalls += 1; throw new Error('unexpected network call'); };
  const missingKey = createMeryoIntelligenceHandler({ env: {}, fetcher });
  const missingModel = createMeryoIntelligenceHandler({ env: { OPENAI_API_KEY: 'test-placeholder' }, fetcher });
  const missingCatalog = createMeryoIntelligenceHandler({ env: { OPENAI_API_KEY: 'test-placeholder', OPENAI_MODEL: 'test-model' }, fetcher });

  assert.deepEqual(await call(missingKey, { method: 'POST', body: { category: 'belleza', message: 'consulta local' } }), { status: 503, payload: { error: 'configuration_pending' } });
  assert.deepEqual(await call(missingModel, { method: 'POST', body: { category: 'belleza', message: 'consulta local' } }), { status: 503, payload: { error: 'configuration_pending' } });
  assert.deepEqual(await call(missingCatalog, { method: 'POST', body: { category: 'belleza', message: 'consulta local' } }), { status: 503, payload: { error: 'catalog_unavailable' } });
  assert.equal(outboundCalls, 0);
});

test('empty catalog returns an honest category-specific state without querying works or the model', async () => {
  const cases = [
    ['barberia', 'Quiero un fade para hoy'],
    ['barberia', 'Busco un barbero cerca'],
    ['belleza', 'Quiero hacerme un balayage'],
    ['belleza', '¿Qué peluquerías hacen coloración?'],
  ];
  for (const [category, message] of cases) {
    const calls = [];
    const handler = createMeryoIntelligenceHandler({
      env: {
        OPENAI_API_KEY: 'test-placeholder',
        OPENAI_MODEL: 'test-model',
        MERYO_SUPABASE_URL: 'https://offline.invalid',
        MERYO_SUPABASE_ANON_KEY: 'test-anon-placeholder',
      },
      fetcher: async (url, options) => {
        calls.push({ url, body: JSON.parse(options.body) });
        assert.ok(url.endsWith('/rpc/meryo_catalogo_categoria'));
        return new Response('[]', { status: 200 });
      },
    });

    const result = await call(handler, { method: 'POST', body: { category, message } });

    assert.equal(result.status, 200);
    assert.equal(result.payload.category, category);
    assert.equal(result.payload.noResults, true);
    assert.deepEqual(result.payload.recommendations, []);
    assert.match(result.payload.answer, category === 'belleza' ? /peluquerías o salones publicados/ : /barberías publicados/);
    assert.deepEqual(calls, [{ url: 'https://offline.invalid/rest/v1/rpc/meryo_catalogo_categoria', body: { p_categoria: category } }]);
  }
});

test('catalog connection errors remain errors and never fall through to the model', async () => {
  let outboundCalls = 0;
  const handler = createMeryoIntelligenceHandler({
    env: {
      OPENAI_API_KEY: 'test-placeholder',
      OPENAI_MODEL: 'test-model',
      MERYO_SUPABASE_URL: 'https://offline.invalid',
      MERYO_SUPABASE_ANON_KEY: 'test-anon-placeholder',
    },
    fetcher: async () => { outboundCalls += 1; throw new Error('offline test connection'); },
  });
  const result = await call(handler, { method: 'POST', body: { category: 'belleza', message: '¿Qué peluquerías hacen coloración?' } });
  assert.deepEqual(result, { status: 503, payload: { error: 'catalog_unavailable' } });
  assert.equal(outboundCalls, 1, 'Only the catalog request was attempted; the model was not called');
});
