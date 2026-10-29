import test from 'node:test';
import assert from 'node:assert/strict';
import {consumeLandingIntro, LANDING_INTRO_SESSION_KEY, markLandingIntroSeen} from '../src/lib/landing-intro.js';

function storageMock() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test('cover introduction is consumed at most once for a browser session', () => {
  const storage = storageMock();
  assert.equal(consumeLandingIntro({storage}), true);
  assert.equal(storage.getItem(LANDING_INTRO_SESSION_KEY), '1');
  assert.equal(consumeLandingIntro({storage}), false);
});

test('reduced motion skips and remembers the entrance', () => {
  const storage = storageMock();
  assert.equal(consumeLandingIntro({storage, reducedMotion:true}), false);
  assert.equal(storage.getItem(LANDING_INTRO_SESSION_KEY), '1');
  assert.equal(consumeLandingIntro({storage}), false);
});

test('internal navigation can mark the session as already introduced', () => {
  const storage = storageMock();
  markLandingIntroSeen(storage);
  assert.equal(consumeLandingIntro({storage}), false);
});
