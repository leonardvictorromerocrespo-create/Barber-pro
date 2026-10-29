export const LANDING_INTRO_SESSION_KEY = 'meryo.landingIntro.seen.v1';

let introSeenInMemory = false;

function browserSessionStorage() {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function markLandingIntroSeen(storage = browserSessionStorage()) {
  if (storage) {
    try {
      storage.setItem(LANDING_INTRO_SESSION_KEY, '1');
      return;
    } catch {
      // Use the per-document fallback when storage is blocked.
    }
  }
  introSeenInMemory = true;
}

export function consumeLandingIntro({ storage = browserSessionStorage(), reducedMotion = false } = {}) {
  if (storage) {
    try {
      if (storage.getItem(LANDING_INTRO_SESSION_KEY) === '1') return false;
      storage.setItem(LANDING_INTRO_SESSION_KEY, '1');
      return !reducedMotion;
    } catch {
      // Use the per-document fallback when storage is blocked.
    }
  }
  if (introSeenInMemory) return false;
  introSeenInMemory = true;
  return !reducedMotion;
}
