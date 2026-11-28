import Sesion from '../models/sesion.model.js';
import { leerCookies } from '../utils/cookies.js';
import { NOMBRE_COOKIE } from '../config/sesion.js';
import { esAdmin } from '../config/admin.js';

const opcionesCookie = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});

export function ponerCookieSesion(res, token) {
  res.cookie(NOMBRE_COOKIE, token, opcionesCookie());
}

export function borrarCookieSesion(res) {
  res.clearCookie(NOMBRE_COOKIE, opcionesCookie());
}

export const tokenDe = (req) => leerCookies(req.headers.cookie)[NOMBRE_COOKIE];

// Carga la sesion (si hay) en req.sesion. No renueva el tiempo: solo la
// actividad real del usuario (/auth/ping, abrir paginas, login) lo hace.
export async function cargarSesion(req, res, next) {
  try {
    const token = tokenDe(req);
    const { estado, sesion } = await Sesion.buscar(token);
    if (estado === 'activa') {
      req.sesion = { ...sesion, esAdmin: esAdmin(sesion.rol)};
    } else if (token) {
      req.sesionExpirada = true;
      borrarCookieSesion(res);
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requiereSesionVista(req, res, next) {
  if (!req.sesion) {
    return res.redirect(req.sesionExpirada ? '/login?expirada=1' : '/login');
  }
  // Evita que el boton "atras" muestre la pagina despues de cerrar sesion
  res.set('Cache-Control', 'no-store');
  next();
}

export function requiereSesionApi(req, res, next) {
  if (!req.sesion) {
    return res.status(401).json({ error: 'Sesion expirada o no iniciada' });
  }
  next();
}

export function soloInvitados(req, res, next) {
  if (req.sesion) return res.redirect('/');
  next();
}
// Solo para administradores (definidos en ADMIN_NUMEROS_CONTROL del .env)
export function requiereAdmin(req, res, next) {
  if (!req.sesion?.esAdmin) {
    return res.status(403).send('No tienes permiso para ver esta página. <a href="/">Volver</a>');
  }
  next();
}