import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {sealKey,openKey} from '../server/recovery-key.mjs';
test('USB recovery envelope recovers the exact key and rejects wrong passwords or tampering',()=>{
 const key=randomBytes(32),password='unit-test-only-strong-password',packet=sealKey(key,password);
 assert.deepEqual(openKey(packet,password),key);
 assert.throws(()=>openKey(packet,'wrong-password'));
 const damaged={...packet,ciphertext:Buffer.alloc(32).toString('base64')};
 assert.throws(()=>openKey(damaged,password));
 assert.throws(()=>openKey({...packet,iterations:1},password));
 assert.throws(()=>sealKey(key,'short'));
});
