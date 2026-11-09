import { fechaLima } from './dates.js';

export const turnKey = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase('es-PE');

const limaClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function priceCeiling(value) {
  return value == null || String(value).trim() === '' ? Infinity : Number(value);
}

function validFilters(filters) {
  const max = priceCeiling(filters?.max);
  return Boolean(
    turnKey(filters?.district) && turnKey(filters?.service) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(filters?.date ?? '')) &&
    /^\d{2}:\d{2}$/.test(String(filters?.after ?? '')) &&
    max > 0 && (Number.isFinite(max) || filters?.max == null || String(filters.max).trim() === ''),
  );
}

export async function findTurns(shops, filters, slots, isCurrent = () => true) {
  if (!validFilters(filters)) return { matches: [], checked: 0, failed: 0, limited: false, allFailed: false };

  const candidates = [];
  const max = priceCeiling(filters.max);
  const category = filters.category === 'belleza' ? 'belleza' : 'barberia';
  for (const shop of shops ?? []) {
    const businessTypes = Array.isArray(shop.businessTypes) && shop.businessTypes.length ? shop.businessTypes : ['barberia'];
    if (!businessTypes.includes(category) && !businessTypes.includes('ambos')) continue;
    if (turnKey(shop.district) !== turnKey(filters.district)) continue;
    for (const service of shop.services ?? []) {
      const price = Number(service.price);
      const duration = Number(service.durationMinutes);
      if (!service.bookable || service.requiresEvaluation === true || turnKey(service.name) !== turnKey(filters.service) ||
          !Number.isFinite(price) || price <= 0 || price > max ||
          !Number.isInteger(duration) || duration <= 0) continue;
      for (const member of shop.equipo ?? []) {
        if (member?.id && member.servicios?.some(id => String(id) === String(service.id))) {
          candidates.push({ shop, service, member });
        }
      }
    }
  }

  // Keep one search bounded even for large catalogs. Candidate order follows the
  // published catalog and the exact service/member assignments it returned.
  const limit = 24;
  const count = Math.min(candidates.length, limit);
  const matches = [];
  let failed = 0;
  let checked = 0;
  let next = 0;

  await Promise.all(Array.from({ length: Math.min(count, 4) }, async () => {
    while (isCurrent() && next < count) {
      const candidate = candidates[next++];
      try {
        const rows = await slots(candidate.shop.id, candidate.service.id, filters.date, candidate.member.id);
        checked += 1;
        if (!isCurrent()) continue;
        const available = new Map();
        for (const row of rows ?? []) {
          const timestamp = Date.parse(row.time);
          if (!row.occupied && Number.isFinite(timestamp) && timestamp >= (filters.notBefore ?? -Infinity) &&
              fechaLima(timestamp) === filters.date && limaClock.format(timestamp) >= filters.after) {
            available.set(timestamp, row);
          }
        }
        const options = [...available.keys()].sort((a, b) => a - b).slice(0, 3).map(time => available.get(time));
        if (options.length) matches.push({ ...candidate, date: filters.date, slot: options[0], options });
      } catch {
        checked += 1;
        failed += 1;
      }
    }
  }));

  matches.sort((a, b) => Date.parse(a.slot.time) - Date.parse(b.slot.time) ||
    Number(a.service.price) - Number(b.service.price) ||
    String(a.shop.name).localeCompare(String(b.shop.name), 'es'));
  const limited = candidates.length > limit;
  return {
    matches, checked, failed, limited,
    // If work was capped, unqueried candidates mean the result is partial even
    // when every completed call failed.
    allFailed: count > 0 && checked === count && failed === count && !limited,
  };
}
