import { build } from 'esbuild';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

// Serves only the isolated fixture. It cannot import the application/backend.
const root = path.resolve('dist/catalog-check');
const result = await build({ entryPoints: ['tests/browser/catalog.jsx'], bundle: true, outfile: path.join(root,'check.js'), jsx: 'automatic', loader: { '.png':'dataurl' }, metafile:true });
if (Object.keys(result.metafile.inputs).some(file => /supabase|src\/App\.jsx|src\/lib\/operations/.test(file.replaceAll('\\','/')))) throw new Error('Fixture must remain disconnected from backend');
const css = (await fs.readdir('dist/assets')).find(name => /^index-.*\.css$/.test(name));
await fs.copyFile(path.join('dist/assets',css),path.join(root,'theme.css'));
await fs.writeFile(path.join(root,'index.html'), '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>MERYO prueba aislada</title><link rel="stylesheet" href="/theme.css"><link rel="stylesheet" href="/check.css"></head><body><div id="root"></div><script src="/check.js"></script></body></html>');
http.createServer(async (req,res) => {
  const files={'/':'index.html','/check.js':'check.js','/check.css':'check.css','/theme.css':'theme.css'};
  const file=files[req.url];
  if(!file){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');
  // Local fixture + OSM tiles only. No Supabase or other service requests.
  res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'none'; img-src 'self' data: https://tile.openstreetmap.org; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'none'; form-action 'none'");
  res.end(await fs.readFile(path.join(root,file)));
}).listen(5176,'127.0.0.1',()=>console.log('Isolated catalog fixture: http://127.0.0.1:5176 (no backend)'));
