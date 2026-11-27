import crypto from 'node:crypto';

export const ROLES = { USUARIO: 'usuario', ADMIN: 'admin' };

// Un usuario es administrador si su rol en la base de datos es 'admin'.
export const esAdmin = (rol) => rol === ROLES.ADMIN;

// Codigo secreto para registrarse como administrador (ADMIN_CODIGO en el .env)
export function codigoAdminValido(codigo) {
  const esperado = String(process.env.ADMIN_CODIGO || '');
  const dado = String(codigo || '');
  if (!esperado || dado.length !== esperado.length) return false;
  return crypto.timingSafeEqual(Buffer.from(dado), Buffer.from(esperado));
}