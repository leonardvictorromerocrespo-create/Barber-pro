import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapShop, createMeryoApi } from '../src/lib/meryo-api.js';

test('profile and reservation use the same active catalog services independent of viewport', async () => {
  const source = {
    id: 41,
    nombre: 'Barbería de prueba',
    distrito: 'Ate Vitarte',
    tipos_negocio: ['barberia'],
    servicios: [
      { id: 1, nombre: 'Corte clásico', activo: true, precio: 30, duracion_min: 30 },
      { id: 2, nombre: 'Degradado', activo: true, precio: 35, duracion_min: 40 },
      { id: 3, nombre: 'Corte antiguo', activo: false, precio: 20, duracion_min: 25 },
      { id: 4, nombre: 'Diseño con evaluación', activo: true, requiere_evaluacion: true, precio: null, duracion_min: null },
    ],
  };
  const calls = [];
  const client = {
    rpc(name, args) {
      calls.push({ name, args });
      return Promise.resolve({ data: [source], error: null });
    },
    storage: { from: () => ({ createSignedUrls: async () => ({ data: [], error: null }) }) },
  };

  const [profileShop] = await createMeryoApi(client).catalog('barberia');
  const profileServices = profileShop.services;
  const reservationServices = profileServices.filter(service => service.bookable);

  assert.deepEqual(profileServices.map(service => service.name), [
    'Corte clásico', 'Degradado', 'Diseño con evaluación',
  ]);
  assert.deepEqual(reservationServices.map(service => service.name), [
    'Corte clásico', 'Degradado',
  ]);
  assert.deepEqual(calls, [{ name: 'meryo_catalogo_categoria', args: { p_categoria: 'barberia' } }]);
  assert.equal(mapShop(source).services.map(service => service.name).join('|'), profileServices.map(service => service.name).join('|'));
});
