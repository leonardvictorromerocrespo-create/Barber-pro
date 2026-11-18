import { build } from 'esbuild';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve('dist/profile-booking-check');
await fs.mkdir(root, { recursive: true });
const result = await build({
  entryPoints: ['tests/browser/profile-booking.jsx'],
  bundle: true,
  outfile: path.join(root, 'check.js'),
  jsx: 'automatic',
  loader: { '.css': 'empty', '.png': 'dataurl', '.webp': 'dataurl' },
  metafile: true,
});
if (Object.keys(result.metafile.inputs).some(file => /supabase|src\/App\.jsx|src\/lib\/operations/.test(file.replaceAll('\\', '/')))) {
  throw new Error('Browser fixture must remain isolated from app services and backend');
}
const css = (await fs.readdir('dist/assets')).find(name => /^index-.*\.css$/.test(name));
if (!css) throw new Error('Build CSS was not found; run npm run build first');
await fs.copyFile(path.join('dist/assets', css), path.join(root, 'theme.css'));
await fs.writeFile(path.join(root, 'index.html'), '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>MERYO reserva aislada</title><link rel="stylesheet" href="/theme.css"></head><body><div id="root"></div><script src="/check.js"></script></body></html>');

const files = { '/': 'index.html', '/check.js': 'check.js', '/theme.css': 'theme.css' };
http.createServer(async (req, res) => {
  const file = files[new URL(req.url, 'http://127.0.0.1').pathname];
  if (!file) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
  res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'none'; form-action 'none'");
  res.end(await fs.readFile(path.join(root, file)));
}).listen(5177, '127.0.0.1', () => console.log('Isolated booking/profile fixture: http://127.0.0.1:5177 (no backend)'));
