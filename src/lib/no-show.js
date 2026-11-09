const NO_SHOW_GRACE_MS = 15 * 60 * 1000;

export function showArrivalControl(row, profile, memberId) {
  return profile?.rol === 'barbero'
    && Boolean(memberId)
    && row?.barbero_id === memberId
    && row?.estado === 'confirmada'
    && !row?.llegada_en;
}

export function showFinishControl(row, profile, memberId) {
  return profile?.rol === 'barbero'
    && Boolean(memberId)
    && row?.barbero_id === memberId
    && row?.estado === 'confirmada'
    && Boolean(row?.llegada_en);
}

export function showNoShowControl(row, profile, memberId) {
  return profile?.rol === 'barbero'
    && Boolean(memberId)
    && row?.barbero_id === memberId
    && row?.estado === 'confirmada'
    && !row?.llegada_en;
}

/** The server clock snapshot keeps the UI aligned with PostgreSQL time. */
export function noShowEligibility(row, serverNow) {
  if (row?.estado !== 'confirmada') return { eligible: false, reason: 'estado' };
  if (row?.llegada_en) return { eligible: false, reason: 'llegada' };
  const paid = Boolean(row.pagada_en)
    && Array.isArray(row.pagos)
    && row.pagos.some(payment => payment.estado === 'pagado');
  if (!paid) return { eligible: false, reason: 'adelanto' };

  const startsAt = Date.parse(row.inicio);
  if (serverNow === null || serverNow === undefined || serverNow === '') return { eligible: false, reason: 'hora' };
  const now = Number(serverNow);
  if (!Number.isFinite(startsAt) || !Number.isFinite(now)) return { eligible: false, reason: 'hora' };
  const eligibleAt = startsAt + NO_SHOW_GRACE_MS;
  return { eligible: now >= eligibleAt, reason: now >= eligibleAt ? '' : 'plazo', eligibleAt };
}
