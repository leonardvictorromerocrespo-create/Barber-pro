import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

test('catalog failure has a clear retry action and is never rendered as empty results',async()=>{
 const output=path.resolve('dist/catalog-status-render/render.mjs');
 await fs.mkdir(path.dirname(output),{recursive:true});
 await build({
  stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import CatalogStatus from './src/components/CatalogStatus.jsx';export const render=(props)=>renderToStaticMarkup(React.createElement(CatalogStatus,props));`,resolveDir:process.cwd(),loader:'jsx'},
  outfile:output,bundle:true,format:'esm',platform:'node',jsx:'automatic',external:['react','react-dom/server'],
 });
 const {render}=await import(pathToFileURL(output).href);
 const html=render({loading:false,error:'Sin conexión',empty:true,businessLabel:'barberías',onRetry:()=>{}});
 assert.match(html,/No pudimos cargar barberías/);
 assert.match(html,/>Reintentar</);
 assert.doesNotMatch(html,/Próximamente encontrarás|0 barberías/);
});
