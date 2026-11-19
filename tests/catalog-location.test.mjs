import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogLocationErrorMessage, CATALOG_GEOLOCATION_OPTIONS, requestCatalogLocation } from '../src/lib/catalog-location.js';
import { selectShops } from '../src/lib/catalog.js';

function fakeGeolocation({ position, error } = {}) {
  const calls=[];
  return {
    calls,
    getCurrentPosition(success,failure,options){
      calls.push(options);
      if(error)failure(error);
      else success(position);
    },
  };
}

test('granted device location returns its real coordinates and sorts catalog by distance',async()=>{
  const geolocation=fakeGeolocation({position:{coords:{latitude:-12.13,longitude:-77.01}}});
  const point=await requestCatalogLocation({geolocation,isSecureContext:true});
  assert.deepEqual(point,{lat:-12.13,lng:-77.01});
  assert.deepEqual(geolocation.calls,[CATALOG_GEOLOCATION_OPTIONS]);
  assert.equal(geolocation.calls[0].timeout,60_000);
  assert.equal(geolocation.calls[0].maximumAge,30_000);
  assert.equal(geolocation.calls[0].enableHighAccuracy,false);
  const shops=[
    {id:'far',name:'Barbería lejana',lat:-12.2,lng:-77.1},
    {id:'near',name:'Barbería cercana',lat:-12.0465,lng:-77.0429},
  ];
  assert.deepEqual(selectShops(shops,{location:point,order:'distance'}).map(shop=>shop.id),['near','far']);
});

test('permission denial explains how to recover without disabling district search',async()=>{
  const geolocation=fakeGeolocation({error:{code:1}});
  await assert.rejects(requestCatalogLocation({geolocation,isSecureContext:true}),error=>{
    assert.equal(error.code,1);
    assert.match(catalogLocationErrorMessage(error),/permiso de MERYO/i);
    assert.match(catalogLocationErrorMessage(error),/distrito/i);
    return true;
  });
});

test('timeout and unavailable position report different recoverable guidance',async()=>{
  for(const [code,expected] of [[3,/tardó demasiado/i],[2,/no está disponible/i]]){
    const geolocation=fakeGeolocation({error:{code}});
    await assert.rejects(requestCatalogLocation({geolocation,isSecureContext:true}),error=>{
      assert.equal(error.code,code);
      assert.match(catalogLocationErrorMessage(error),expected);
      assert.match(catalogLocationErrorMessage(error),/distrito/i);
      return true;
    });
  }
});

test('a location error does not interfere with manual district filtering',async()=>{
  const geolocation=fakeGeolocation({error:{code:2}});
  await assert.rejects(requestCatalogLocation({geolocation,isSecureContext:true}));
  const shops=[
    {id:'ate',name:'Local en Ate Vitarte',district:'Ate Vitarte'},
    {id:'comas',name:'Local en Comas',district:'Comas'},
  ];
  assert.deepEqual(selectShops(shops,{district:'Ate Vitarte'}).map(shop=>shop.id),['ate']);
});

test('insecure contexts, unsupported browsers, and invalid coordinates never invent a location',async()=>{
  await assert.rejects(requestCatalogLocation({geolocation:fakeGeolocation(),isSecureContext:false}),error=>{
    assert.equal(error.kind,'insecure-context');
    assert.match(catalogLocationErrorMessage(error),/HTTPS/i);
    return true;
  });
  await assert.rejects(requestCatalogLocation({geolocation:null,isSecureContext:true}),error=>{
    assert.equal(error.kind,'unsupported');
    return true;
  });
  await assert.rejects(requestCatalogLocation({geolocation:fakeGeolocation({position:{coords:{latitude:140,longitude:-77}}}),isSecureContext:true}),error=>{
    assert.equal(error.kind,'invalid-position');
    assert.match(catalogLocationErrorMessage(error),/coordenadas válidas/i);
    return true;
  });
});
