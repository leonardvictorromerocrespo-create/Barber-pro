import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const chrome = process.env.CHROME_BIN || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
assert.ok(existsSync(chrome), `No se encontró Chrome en ${chrome}`);
assert.equal(typeof WebSocket, 'function', 'Este script requiere WebSocket integrado de Node.js.');
const outputDirectory = mkdtempSync(path.join(os.tmpdir(), 'meryo-booking-screens-'));

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function verifyViewport(label, width, height) {
  const userData = mkdtempSync(path.join(os.tmpdir(), 'meryo-booking-headless-'));
  const portFile = path.join(userData, 'DevToolsActivePort');
  const browser = spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-sync',
    '--no-first-run',
    '--disable-default-apps',
    '--remote-debugging-port=0',
    `--user-data-dir=${userData}`,
    '--window-size=800,1000',
    'about:blank',
  ], { stdio: 'ignore', windowsHide: true });

  let socket;
  try {
    for (let attempt = 0; attempt < 120 && !existsSync(portFile); attempt += 1) {
      if (browser.exitCode !== null) throw new Error(`Chrome terminó antes de abrir DevTools (${browser.exitCode}).`);
      await delay(50);
    }
    assert.ok(existsSync(portFile), 'Chrome no abrió el puerto de control aislado.');
    const port = Number(readFileSync(portFile, 'utf8').split(/\r?\n/, 1)[0]);
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
    const page = targets.find(target => target.type === 'page');
    assert.ok(page?.webSocketDebuggerUrl, 'No se encontró la pestaña local de prueba.');

    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    let nextId = 0;
    const pending = new Map();
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      const current = pending.get(message.id);
      if (current) { pending.delete(message.id); current.resolve(message); }
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (pending.has(id)) { pending.delete(id); reject(new Error(`DevTools timeout: ${method}`)); }
      }, 10000).unref?.();
    });

    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width <= 500,
    });
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: 'http://127.0.0.1:5177/?test=1' });

    let pageState;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      await delay(50);
      const response = await send('Runtime.evaluate', {
        expression: `JSON.stringify({result:document.body?.dataset.testResult||'',report:document.querySelector('[data-test-report]')?.textContent||'',width:window.innerWidth,height:window.innerHeight,scrollWidth:document.documentElement?.scrollWidth||0})`,
        returnByValue: true,
      });
      const value = response.result?.result?.value;
      if (value) pageState = JSON.parse(value);
      if (pageState?.result) break;
    }

    assert.equal(pageState?.width, width, `${label}: el navegador no aplicó el ancho solicitado (${pageState?.width}px).`);
    assert.equal(pageState?.height, height, `${label}: el navegador no aplicó la altura solicitada.`);
    assert.equal(pageState?.result, 'pass', `${label}: ${pageState?.report || 'el flujo no terminó.'}`);
    assert.ok(pageState.scrollWidth <= width, `${label}: hay desbordamiento horizontal (${pageState.scrollWidth}px para ${width}px).`);

    const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const imagePath = path.join(outputDirectory, `booking-${width}.png`);
    writeFileSync(imagePath, Buffer.from(screenshot.result.data, 'base64'));
    console.log(`${label}: ${pageState.report} Sin desbordamiento horizontal. Captura ${imagePath}`);
  } finally {
    if (socket && socket.readyState === WebSocket.OPEN) socket.close();
    if (browser.exitCode === null) browser.kill();
  }
}

for (const [label, width, height] of [['móvil 360 px', 360, 800], ['móvil 390 px', 390, 844], ['escritorio', 1365, 900]]) {
  await verifyViewport(label, width, height);
}
