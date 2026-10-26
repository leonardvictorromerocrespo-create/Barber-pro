import {test} from 'node:test';
import assert from 'node:assert/strict';
import {remainingSeconds,countdown} from '../src/lib/booking-time.js';
test('countdown uses server clock and monotonic elapsed time; zero never declares expiry',()=>{
 const server=Date.parse('2026-10-26T12:00:00Z');
 assert.equal(remainingSeconds('2026-10-26T12:15:00Z',server),900);
 assert.equal(remainingSeconds('2026-10-26T12:15:00Z',server,60000),840);
 assert.equal(remainingSeconds(null,server),null);assert.equal(countdown(900),'15:00');
 assert.match(countdown(0),/Validando.*servidor/);
});
