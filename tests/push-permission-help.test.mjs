import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pushPermissionHelp} from '../src/lib/push-permission-help.js';

test('blocked-permission help detects Edge before its Chromium user-agent tokens',()=>{
 const help=pushPermissionHelp('Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0');
 assert.equal(help.browser,'Microsoft Edge');
 assert.match(help.steps,/Edge/);
 assert.match(help.steps,/Notificaciones → Permitir/);
});

test('blocked-permission help identifies Firefox, Chrome and Safari independently',()=>{
 assert.equal(pushPermissionHelp('Mozilla/5.0 Firefox/132.0').browser,'Firefox');
 assert.equal(pushPermissionHelp('Mozilla/5.0 Chrome/132.0 Safari/537.36').browser,'Chrome');
 assert.equal(pushPermissionHelp('Mozilla/5.0 Version/18.0 Safari/605.1.15').browser,'Safari');
});
