// Lectura de cookies sin dependencias externas
export function leerCookies(header = '') {
  const cookies = {};
  for (const parte of header.split(';')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    const nombre = parte.slice(0, i).trim();
    if (!nombre) continue;
    try {
      cookies[nombre] = decodeURIComponent(parte.slice(i + 1).trim());
    } catch {
      cookies[nombre] = parte.slice(i + 1).trim();
    }
  }
  return cookies;
}
