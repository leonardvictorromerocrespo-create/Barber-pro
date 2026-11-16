import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMeryoApi } from '../src/lib/meryo-api.js';

function mockClient(rows, signedPaths) {
  return {
    rpc(name, args) {
      assert.equal(name, 'meryo_catalogo_categoria');
      assert.equal(args.p_categoria, 'barberia');
      return Promise.resolve({ data: rows, error: null });
    },
    storage: {
      from() {
        return {
          createSignedUrls: async paths => {
            signedPaths.push([...paths]);
            return { data: paths.map(path => ({ signedUrl: 'https://media.test/' + path })), error: null };
          },
        };
      },
    },
  };
}

test('refreshing a profile returns and signs only the selected business', async () => {
  const shops = [9, 10].map(id => ({
    id,
    nombre: 'Negocio ' + id,
    distrito: 'Ate Vitarte',
    servicios: [{ id, nombre: 'Servicio ' + id, precio: 30, duracion_min: 30, activo: true }],
    tipos_negocio: ['barberia'],
    assets: [{ id: 'cover-' + id, kind: 'portada', object_path: id + '/cover.webp' }],
  }));
  const signedPaths = [];
  const rows = await createMeryoApi(mockClient(shops, signedPaths)).catalog('barberia', { shopId: 10 });

  assert.deepEqual(rows.map(shop => shop.id), [10]);
  assert.equal(rows[0].services[0].name, 'Servicio 10');
  assert.deepEqual(signedPaths, [['10/cover.webp']]);
});
