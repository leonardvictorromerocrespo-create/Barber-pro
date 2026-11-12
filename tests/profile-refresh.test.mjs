import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProfileRefreshCoordinator } from '../src/lib/profile-refresh.js';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function harness(fetchCatalog, selectedShop, catalogState) {
  return {
    get selectedShop() { return selectedShop; },
    get catalogState() { return catalogState; },
    setSelectedShop(update) { selectedShop = typeof update === 'function' ? update(selectedShop) : update; },
    setCatalogState(update) { catalogState = typeof update === 'function' ? update(catalogState) : update; },
    coordinator: createProfileRefreshCoordinator({
      fetchCatalog,
      setSelectedShop(update) { selectedShop = typeof update === 'function' ? update(selectedShop) : update; },
      setCatalogState(update) { catalogState = typeof update === 'function' ? update(catalogState) : update; },
    }),
  };
}

test('opening a profile refreshes services but keeps media already loaded', async () => {
  const cached = { id: 41, services: [{ id: 8, name: 'Servicio anterior', price: 25 }],
    assets: [{ id: 'work', kind: 'foto', url: '/trabajo.webp' }], profileImage: '/perfil.webp', coverImage: '/portada.webp' };
  const fresh = { id: '41', services: [{ id: 8, name: 'Servicio actualizado', price: 32 }], assets: [],
    profileImage: null, coverImage: '/portada-nueva.webp' };
  const state = harness(async (category, shopId) => {
    assert.equal(category, 'barberia');
    assert.equal(shopId, '41');
    return [fresh];
  }, cached, { category: 'barberia', rows: [cached], loading: false, error: '' });

  assert.equal(await state.coordinator.refresh(cached, 'barberia'), true);
  assert.equal(state.selectedShop.services[0].name, 'Servicio actualizado');
  assert.equal(state.selectedShop.services[0].price, 32);
  assert.equal(state.selectedShop.assets, cached.assets);
  assert.equal(state.selectedShop.profileImage, '/perfil.webp');
  assert.equal(state.selectedShop.coverImage, '/portada.webp');
  assert.equal(state.catalogState.rows[0].services[0].name, 'Servicio actualizado');
});

test('a late response cannot replace a newly opened profile or category', async () => {
  const barberRequest = deferred();
  const salonRequest = deferred();
  let calls = 0;
  const oldShop = { id: 41, services: [{ id: 8, name: 'Corte anterior' }] };
  const newShop = { id: 52, services: [{ id: 9, name: 'Color actual' }] };
  const state = harness(() => (++calls === 1 ? barberRequest.promise : salonRequest.promise), oldShop,
    { category: 'belleza', rows: [newShop], loading: false, error: '' });

  const stale = state.coordinator.refresh(oldShop, 'barberia');
  state.setSelectedShop(newShop);
  const current = state.coordinator.refresh(newShop, 'belleza');
  barberRequest.resolve([{ id: 41, services: [{ id: 8, name: 'Respuesta antigua' }] }]);
  await stale;
  assert.equal(state.selectedShop.id, 52);
  assert.equal(state.catalogState.category, 'belleza');
  assert.equal(state.catalogState.rows[0].services[0].name, 'Color actual');

  salonRequest.resolve([{ id: 52, services: [{ id: 9, name: 'Color actualizado' }] }]);
  await current;
  assert.equal(state.selectedShop.id, 52);
  assert.equal(state.selectedShop.services[0].name, 'Color actualizado');
  assert.equal(state.catalogState.rows[0].services[0].name, 'Color actualizado');
});

test('closing a profile invalidates its pending refresh', async () => {
  const request = deferred();
  const shop = { id: 41, services: [{ id: 8, name: 'Servicio anterior' }] };
  const state = harness(() => request.promise, shop, { category: 'barberia', rows: [shop], loading: false, error: '' });
  const pending = state.coordinator.refresh(shop, 'barberia');
  state.coordinator.invalidate();
  request.resolve([{ id: 41, services: [{ id: 8, name: 'Respuesta tardía' }] }]);
  assert.equal(await pending, false);
  assert.equal(state.selectedShop.services[0].name, 'Servicio anterior');
});
