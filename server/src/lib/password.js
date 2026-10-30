import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };
const KEYLEN = 64;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [alg, N, r, p, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: PARAMS.maxmem,
  });
  return crypto.timingSafeEqual(actual, expected);
}

/** Devuelve un mensaje de error o null si la contraseña cumple la política. */
export function passwordProblem(password, { email, name } = {}) {
  if (typeof password !== 'string' || password.length < 12) return 'La contraseña debe tener al menos 12 caracteres';
  if (password.length > 200) return 'La contraseña es demasiado larga';
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes < 3) return 'Combina al menos tres de: minúsculas, mayúsculas, números y símbolos';
  const lower = password.toLowerCase();
  if (email && lower.includes(String(email).split('@')[0].toLowerCase())) return 'La contraseña no puede contener tu email';
  if (name && name.length > 3 && lower.includes(name.toLowerCase())) return 'La contraseña no puede contener tu nombre';
  return null;
}

let dummy = null;
/** Hash de relleno para igualar el tiempo de respuesta cuando el usuario no existe. */
export async function dummyHash() {
  if (!dummy) dummy = await hashPassword(crypto.randomBytes(16).toString('hex'));
  return dummy;
}
