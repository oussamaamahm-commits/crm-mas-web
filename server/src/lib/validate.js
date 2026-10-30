import { z } from 'zod';
import { badRequest } from './errors.js';

export { z };

export function parse(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    const fields = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issue.message;
    }
    throw badRequest('Revisa los campos marcados', fields);
  }
  return result.data;
}

const emptyToNull = (schema) => z.preprocess((v) => (v === '' || v === undefined ? null : v), schema.nullable()).optional();
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isRealDate = (s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);

/** Constructores de campos con mensajes en español. */
export const f = {
  text: (max = 200) => z.string({ required_error: 'Obligatorio', invalid_type_error: 'Obligatorio' }).trim().min(1, 'Obligatorio').max(max, `Máximo ${max} caracteres`),
  optText: (max = 200) => emptyToNull(z.string().trim().max(max, `Máximo ${max} caracteres`)),
  email: () => z.string({ required_error: 'Obligatorio' }).trim().toLowerCase().email('Email no válido').max(200),
  optEmail: () => emptyToNull(z.string().trim().toLowerCase().email('Email no válido').max(200)),
  optPhone: () => emptyToNull(z.string().trim().regex(/^[+()\d\s.-]{6,25}$/, 'Teléfono no válido')),
  date: () => z.string({ required_error: 'Obligatorio' }).regex(ISO_DATE, 'Fecha no válida').refine(isRealDate, 'Fecha no válida'),
  optDate: () => emptyToNull(z.string().regex(ISO_DATE, 'Fecha no válida').refine(isRealDate, 'Fecha no válida')),
  id: () => z.coerce.number({ invalid_type_error: 'Obligatorio' }).int().positive('Obligatorio'),
  optId: () => emptyToNull(z.coerce.number().int().positive()),
  cents: () => z.coerce.number({ invalid_type_error: 'Importe no válido' }).int('Importe no válido').min(0, 'No puede ser negativo').max(1e12),
  positiveCents: () => z.coerce.number({ invalid_type_error: 'Importe no válido' }).int('Importe no válido').positive('Debe ser mayor que cero').max(1e12),
  optCents: () => emptyToNull(z.coerce.number().int('Importe no válido').min(0, 'No puede ser negativo').max(1e12)),
  int: (min, max) => z.coerce.number().int().min(min).max(max),
  pct: () => z.coerce.number().min(0, 'Mínimo 0').max(100, 'Máximo 100'),
  oneOf: (values, message = 'Valor no válido') => z.enum(values, { errorMap: () => ({ message }) }),
  optOneOf: (values) => emptyToNull(z.enum(values, { errorMap: () => ({ message: 'Valor no válido' }) })),
  bool: () => z.preprocess((v) => v === true || v === 1 || v === '1' || v === 'true', z.boolean()),
  tags: () => z.array(z.string().trim().min(1).max(40)).max(20, 'Máximo 20 etiquetas').default([]),
  url: () => emptyToNull(z.string().trim().url('URL no válida').max(500).refine((u) => /^https?:\/\//i.test(u), 'Solo se admiten URLs http(s)')),
};

/** Valida NIF, NIE o CIF españoles. */
export function isValidSpanishTaxId(raw) {
  const v = String(raw).toUpperCase().replace(/[\s-]/g, '');
  const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
  if (/^\d{8}[A-Z]$/.test(v)) return letters[Number(v.slice(0, 8)) % 23] === v[8];
  if (/^[XYZ]\d{7}[A-Z]$/.test(v)) {
    const num = Number('XYZ'.indexOf(v[0]) + v.slice(1, 8));
    return letters[num % 23] === v[8];
  }
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(v)) {
    const digits = v.slice(1, 8).split('').map(Number);
    let sum = 0;
    digits.forEach((d, i) => {
      if (i % 2 === 0) {
        const x = d * 2;
        sum += Math.floor(x / 10) + (x % 10);
      } else sum += d;
    });
    const control = (10 - (sum % 10)) % 10;
    const last = v[8];
    return last === String(control) || last === 'JABCDEFGHI'[control];
  }
  return false;
}
