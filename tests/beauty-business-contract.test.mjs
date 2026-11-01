import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {mapShop} from '../src/lib/meryo-api.js';

test('salon services requiring evaluation stay unpriced and cannot enter booking UI',async()=>{
 const shop=mapShop({id:1,nombre:'Salón aislado',tipos_negocio:['belleza'],servicios:[
  {id:2,nombre:'Coloración',activo:true,categoria:'coloracion',requiere_evaluacion:false,precio:80,duracion_min:90},
  {id:3,nombre:'Tratamiento a evaluar',activo:true,categoria:'tratamientos_capilares',requiere_evaluacion:true,precio:null,duracion_min:null},
 ]});
 assert.deepEqual(shop.businessTypes,['belleza']);
 assert.equal(shop.services[0].bookable,true);assert.equal(shop.services[1].bookable,false);
 assert.equal(shop.services[1].price,null);assert.equal(shop.services[1].duration,null);
 const app=await fs.readFile(new URL('../src/App.jsx',import.meta.url),'utf8');
 assert.match(app,/selectedShop\.services\.filter\(service=>service\.bookable\)/);
 assert.match(app,/service\.bookable\?\<p/);
});

test('incremental SQL keeps existing businesses as barbershops and reuses current secure registration/catalog contracts',async()=>{
 const sql=await fs.readFile(new URL('../db/incremental/022_beauty_business_catalog.sql',import.meta.url),'utf8');
 assert.match(sql,/default array\['barberia'\]/i);
 assert.match(sql,/public\.registrar_barberia\(/);
 assert.match(sql,/p_tipo_negocio is null or p_tipo_negocio not in/);
 assert.match(sql,/public\.meryo_catalogo_publico\(\)/);
 assert.match(sql,/public\.meryo_es_propietario\(shop_id\)/);
 assert.match(sql,/not s\.requiere_evaluacion and s\.precio is not null and s\.duracion_min is not null/);
 assert.match(sql,/servicio_reservable/);
 assert.match(sql,/meryo_private\.member_time_ok\(p_member,t,t\+make_interval\(mins=>duration\)\)/);
 assert.doesNotMatch(sql,/update\s+public\.profiles\s+set\s+rol\s*=/i);
});
