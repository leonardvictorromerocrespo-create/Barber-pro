import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coordinates, distanciaKm, selectShops, catalogMarkers } from '../src/lib/catalog.js';
import { fechaLima, listaDias, sumarDias } from '../src/lib/dates.js';

const shops = [
  { id: 1, name: 'Corte Rímac', district: 'Rímac', rating: 4.8, reviews: 1, basePrice: 30, lat: -12.04, lng: -77.04 },
  { id: 2, name: 'Estilo Lima', district: 'Ate', rating: 4.5, reviews: 800, basePrice: 20, lat: null, lng: null },
  { id: 3, name: 'Otro corte', district: 'Rímac', rating: 4.8, reviews: 20, basePrice: null, lat: -12.08, lng: -77.04 },
];
test('search ignores accents/case and combines district without mutating source', () => {
  const before = structuredClone(shops);
  assert.deepEqual(selectShops(shops, { query: ' RIMAC ', district: 'Rímac' }).map(s => s.id), [1, 3]);
  assert.deepEqual(selectShops(shops, { query: 'estilo', district: 'Rímac' }), []);
  assert.deepEqual(shops, before);
});
test('default order is alphabetical; unavailable prices are last', () => {
  assert.deepEqual(selectShops(shops).map(s => s.id), [1, 2, 3]);
  assert.deepEqual(selectShops(shops, { order: 'price' }).map(s => s.id), [2, 1, 3]);
});
test('distance needs real coordinates; absent points are never placed at zero', () => {
  for (const value of [null, { lat: null, lng: 1 }, { lat: '', lng: '' }, { lat: 91, lng: 0 }, { lat: 'bad', lng: 0 }]) assert.equal(coordinates(value), null);
  assert.deepEqual(coordinates({ lat: '0', lng: '0' }), { lat: 0, lng: 0 });
  assert.equal(distanciaKm(shops[0], shops[0]), 0);
  assert.ok(distanciaKm(shops[0], shops[2]) > 4 && distanciaKm(shops[0], shops[2]) < 5);
  assert.deepEqual(selectShops(shops, { order: 'distance', location: shops[0] }).map(s => s.id), [1, 3, 2]);
  assert.deepEqual(catalogMarkers(shops).map(s => s.id), [1, 3]);
  assert.deepEqual(selectShops(shops, { order: 'distance' }).map(s => s.id), [1, 2, 3]);
});
test('Lima day remains previous date before 05:00 UTC and crosses year/leap boundaries', () => {
  assert.equal(fechaLima('2026-10-25T04:59:59Z'), '2026-10-24');
  assert.equal(fechaLima('2026-10-25T05:00:00Z'), '2026-10-25');
  assert.deepEqual(listaDias(3, new Date('2026-01-01T02:00:00Z')), ['2025-12-31', '2026-01-01', '2026-01-02']);
  assert.equal(sumarDias('2024-02-28', 1), '2024-02-29');
});
