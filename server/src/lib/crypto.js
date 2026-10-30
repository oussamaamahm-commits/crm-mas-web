import crypto from 'node:crypto';
import { config } from '../config.js';
import { HttpError } from './errors.js';

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export function safeEqual(a, b) {
  const ba = Buffer.from(String(a ?? ''));
  const bb = Buffer.from(String(b ?? ''));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function key() {
  if (!config.masterKey) throw new HttpError(503, 'El cifrado no está disponible: falta MASTER_KEY en el servidor');
  return config.masterKey;
}

/** Cifra con AES-256-GCM. Formato: v1:iv:tag:ciphertext (base64url). */
export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join(':');
}

export function decryptSecret(blob) {
  const [version, iv, tag, data] = String(blob).split(':');
  if (version !== 'v1') throw new Error('Formato de secreto desconocido');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

/** Pista no reversible para identificar un token sin mostrarlo. */
export const secretHint = (value) => (value && value.length > 8 ? `••••${value.slice(-4)}` : '••••');
