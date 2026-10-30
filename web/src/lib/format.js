const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const eurShort = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat('es-ES');

export const money = (cents, { short = false } = {}) => (cents == null ? '—' : (short ? eurShort : eur).format(cents / 100));
export const moneyCompact = (cents) => (cents == null ? '—' : `${compact.format(cents / 100)} €`);
export const int = (n) => (n == null ? '—' : integer.format(n));
export const pct = (n, digits = 0) => (n == null ? '—' : `${Number(n).toLocaleString('es-ES', { maximumFractionDigits: digits })} %`);

/** "12,50" | "12.50" | "1.234,56" → céntimos. */
export function toCents(value) {
  if (value === '' || value == null) return null;
  if (typeof value === 'number') return Math.round(value * 100);
  let s = String(value).trim().replace(/\s|€/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}
export const centsToInput = (cents) => (cents == null ? '' : (cents / 100).toFixed(2).replace('.', ','));

const dFmt = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
const dShort = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const dtFmt = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const long = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const parseDate = (v) => (typeof v === 'string' && v.length === 10 ? new Date(`${v}T12:00:00`) : new Date(v));
export const date = (v) => (v ? dFmt.format(parseDate(v)).replace('.', '') : '—');
export const dateShort = (v) => (v ? dShort.format(parseDate(v)).replace('.', '') : '—');
export const dateTime = (v) => (v ? dtFmt.format(new Date(v)).replace('.', '') : '—');
export const longDate = (v = new Date()) => {
  const s = long.format(v);
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());

const rtf = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' });
export function relative(v) {
  if (!v) return '—';
  const diff = (new Date(v).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return 'ahora mismo';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return date(v);
}

export function daysUntil(isoDate) {
  if (!isoDate) return null;
  const today = new Date(`${todayIso()}T12:00:00`);
  return Math.round((parseDate(isoDate.slice(0, 10)).getTime() - today.getTime()) / 86400000);
}

export function bytes(n) {
  if (n == null) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toLocaleString('es-ES', { maximumFractionDigits: v < 10 && i > 0 ? 1 : 0 })} ${units[i]}`;
}

export function duration(seconds) {
  if (seconds == null) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
}

export const initials = (name = '') =>
  name
    .replace(/\[DEMO\]\s*/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '·';

export const isDemoLabel = (s) => typeof s === 'string' && s.includes('[DEMO]');
