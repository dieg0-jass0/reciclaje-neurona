// Tiempo de inactividad tras el cual se cierra la sesion (por defecto 60 s).
const segundos = Number(process.env.SESION_INACTIVIDAD_SEG) || 60;

export const INACTIVIDAD_MS = segundos * 1000;

// El navegador cierra la sesion exactamente al cumplirse INACTIVIDAD_MS.
// El servidor da unos segundos de margen para no cortar antes que el navegador
// (los avisos de actividad se envian como maximo cada 5 s).
export const MARGEN_SERVIDOR_MS = 10 * 1000;

export const NOMBRE_COOKIE = 'sid';
