// Lima date utilities adapted from the ZIP; no reservation state/business rules.
export const TZ = 'America/Lima';
const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
export const fechaLima = instant => dateFormatter.format(new Date(instant));
export function sumarDias(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function listaDias(count = 3, now = new Date()) {
  const today = fechaLima(now);
  return Array.from({ length: count }, (_, index) => sumarDias(today, index));
}
