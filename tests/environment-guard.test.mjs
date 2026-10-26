import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
test('an unconfigured preview never silently connects to the production project',async()=>{
 const output=path.resolve('dist/environment-check.mjs');await fs.mkdir(path.dirname(output),{recursive:true});
 await build({entryPoints:['src/lib/supabase.js'],outfile:output,bundle:true,platform:'node',format:'esm',define:{'import.meta.env':'{}'},external:['@supabase/supabase-js']});
 const previous=globalThis.window;globalThis.window={location:{hostname:'preview.meryo.invalid'}};
 try{await assert.rejects(import(pathToFileURL(output).href),/No hay conexión automática a producción/);}finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
