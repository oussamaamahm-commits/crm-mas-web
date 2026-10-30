// Fechas de negocio en zona horaria de Madrid; marcas de tiempo técnicas en UTC.
const TZ = 'Europe/Madrid';
const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export const today = (date = new Date()) => ymd.format(date);

export function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonths(isoDate, months) {
  const [y, m, day] = isoDate.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1, 12));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export const monthStart = (isoDate = today()) => `${isoDate.slice(0, 7)}-01`;

export function daysBetween(fromIso, toIso) {
  return Math.round((Date.parse(`${toIso}T12:00:00Z`) - Date.parse(`${fromIso}T12:00:00Z`)) / 86400000);
}

const FREQUENCY_MONTHS = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 };

export function nextOccurrence(isoDate, frequency) {
  if (frequency === 'weekly') return addDays(isoDate, 7);
  return addMonths(isoDate, FREQUENCY_MONTHS[frequency] ?? 1);
}

export const MONTHLY_FACTOR = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, semiannual: 1 / 6, yearly: 1 / 12, one_time: 0 };
