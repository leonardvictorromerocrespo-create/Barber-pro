import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import {renderToStaticMarkup} from 'react-dom/server';

test('store catalog renders four synthetic published products as compact photo/name/price cards',async()=>{
 const out=path.join(process.cwd(),'node_modules','.cache',`meryo-store-grid-${process.pid}.mjs`);
 await fs.mkdir(path.dirname(out),{recursive:true});
 await build({stdin:{contents:`import React from 'react';import {StoreProductGrid} from './src/components/store/StoreModal.jsx';export function render(products){return React.createElement(StoreProductGrid,{products,cart:new Map(),onOpen(){}});}`,resolveDir:process.cwd(),loader:'jsx'},outfile:out,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react']});
 const {render}=await import(pathToFileURL(out).href);
 const syntheticProducts=[1,2,3,4].map(id=>({id,nombre:`Producto de prueba ${id}`,descripcion:`Descripción de prueba ${id}`,precio:10+id,foto_url:`/synthetic-${id}.jpg`,stock_disponible:5}));
 const html=renderToStaticMarkup(render(syntheticProducts));
 assert.equal((html.match(/class="meryo-store-product(?: is-selected)?"/g)||[]).length,4);
 for(const product of syntheticProducts){assert.match(html,new RegExp(product.nombre));assert.match(html,new RegExp(`S/ ${product.precio}\\.00`));assert.match(html,new RegExp(`src="${product.foto_url}"`));assert.doesNotMatch(html,new RegExp(product.descripcion));}
 assert.match(html,/aria-haspopup="dialog"/);
 assert.match(await fs.readFile('src/index.css','utf8'),/\.meryo-store-grid\s*\{[^}]*repeat\(2,minmax\(0,1fr\)\)/s);
 assert.match(await fs.readFile('src/index.css','utf8'),/@media \(min-width: 1024px\) \{ \.meryo-store-grid \{ grid-template-columns: repeat\(4,minmax\(0,1fr\)\)/);
});
