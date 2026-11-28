import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const LARGO_CLAVE = 64;

// Devuelve "sal:hash" en hexadecimal
export async function cifrarPassword(password) {
  const sal = crypto.randomBytes(16).toString('hex');
  const hash = await scrypt(password, sal, LARGO_CLAVE);
  return `${sal}:${hash.toString('hex')}`;
}

export async function verificarPassword(password, guardado) {
  const [sal, hashHex] = String(guardado).split(':');
  if (!sal || !hashHex) return false;
  const esperado = Buffer.from(hashHex, 'hex');
  const calculado = await scrypt(password, sal, esperado.length);
  return esperado.length === calculado.length && crypto.timingSafeEqual(esperado, calculado);
}
