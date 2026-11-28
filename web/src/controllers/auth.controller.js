import Usuario, { UsuarioExisteError, CARRERAS } from '../models/usuario.model.js';
import Sesion from '../models/sesion.model.js';
import { ponerCookieSesion, borrarCookieSesion, tokenDe } from '../middleware/auth.js';
import { INACTIVIDAD_MS } from '../config/sesion.js';
import { enviarAvisoRegistro } from '../services/correo.service.js';
import { ROLES, esAdmin, codigoAdminValido } from '../config/admin.js';

const NUMERO_CONTROL_VALIDO = /^[A-Z0-9]{4,15}$/;
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;

// Lista para el <select>, marcando la carrera elegida
const opcionesCarrera = (elegida) => CARRERAS.map((nombre) => ({ nombre, seleccionada: nombre === elegida }));

function textoInactividad() {
  const seg = Math.round(INACTIVIDAD_MS / 1000);
  if (seg % 60 === 0) {
    const min = seg / 60;
    return min === 1 ? '1 minuto' : `${min} minutos`;
  }
  return `${seg} segundos`;
}

async function iniciarSesion(res, usuario) {
  const token = await Sesion.crear(usuario);
  ponerCookieSesion(res, token);
}

export function vistaLogin(req, res) {
  let aviso = null;
  if (req.query.expirada) aviso = `Tu sesión se cerró por ${textoInactividad()} de inactividad.`;
  res.render('login', { titulo: 'Iniciar sesión', aviso });
}

export async function login(req, res, next) {
  try {
    const numeroControl = String(req.body.numeroControl || '').toUpperCase().trim();
    const password = String(req.body.password || '');
    const comoAdmin = req.body.tipo === 'admin';

    const volver = (status, error) =>
      res.status(status).render('login', { titulo: 'Iniciar sesión', error, numeroControl, comoAdmin });

    const usuario = await Usuario.autenticar(numeroControl, password);
    if (!usuario) return volver(401, 'Número de control o contraseña incorrectos');
    if (comoAdmin && !esAdmin(usuario.rol)) {
      return volver(403, 'Tu cuenta no es de administrador. Entra como usuario.');
    }

    await iniciarSesion(res, usuario);
    res.redirect(comoAdmin ? '/admin' : '/');
  } catch (err) {
    next(err);
  }
}

export function vistaRegistro(req, res) {
  res.render('registro', { titulo: 'Crear cuenta', minPassword: MIN_PASSWORD, carreras: opcionesCarrera() });
}

export async function registro(req, res, next) {
  const comoAdmin = req.body.tipo === 'admin';
  const numeroControl = String(req.body.numeroControl || '').toUpperCase().trim();
  const nombreCompleto = String(req.body.nombreCompleto || '').trim().replace(/\s+/g, ' ');
  const correo = String(req.body.correo || '').toLowerCase().trim();
  const carrera = String(req.body.carrera || '');
  const password = String(req.body.password || '');
  const confirmar = String(req.body.confirmar || '');

  const fallar = (error) =>
    res.status(400).render('registro', {
      titulo: 'Crear cuenta',
      error,
      comoAdmin,
      numeroControl,
      nombreCompleto,
      correo,
      carreras: opcionesCarrera(carrera),
      minPassword: MIN_PASSWORD,
    });

  if (!NUMERO_CONTROL_VALIDO.test(numeroControl)) {
    return fallar('El número de control debe tener de 4 a 15 letras o números, sin espacios.');
  }
  if (nombreCompleto.length < 3 || nombreCompleto.length > 100) return fallar('Escribe tu nombre completo.');
  if (!CORREO_VALIDO.test(correo)) return fallar('Escribe un correo electrónico válido.');
  if (comoAdmin) {
    if (!process.env.ADMIN_CODIGO) return fallar('El registro de administradores no está habilitado (falta ADMIN_CODIGO en el .env).');
    if (!codigoAdminValido(req.body.codigoAdmin)) return fallar('El código de administrador no es correcto.');
  } else if (!CARRERAS.includes(carrera)) {
    return fallar('Selecciona tu carrera.');
  }
  if (password.length < MIN_PASSWORD) return fallar(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
  if (password !== confirmar) return fallar('Las contraseñas no coinciden.');

  try {
    const usuario = await Usuario.crear({
      numeroControl,
      nombreCompleto,
      correo,
      rol: comoAdmin ? ROLES.ADMIN : ROLES.USUARIO,
      carrera,
      password,
    });

    // El aviso se envia en segundo plano: si el correo falla, el registro igual queda hecho
    enviarAvisoRegistro(usuario)
      .then(() => console.log(`Correo de registro enviado a ${usuario.correo}`))
      .catch((err) => console.error(`No se pudo enviar el correo a ${usuario.correo}:`, err.message));

    await iniciarSesion(res, usuario);
    res.redirect(comoAdmin ? '/admin' : '/');
  } catch (err) {
    if (err instanceof UsuarioExisteError) return fallar(err.message);
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    await Sesion.eliminar(tokenDe(req));
    borrarCookieSesion(res);
    res.redirect('/login');
  } catch (err) {
    next(err);
  }
}

// El navegador avisa que el usuario sigue activo
export async function ping(req, res, next) {
  try {
    await Sesion.renovar(req.sesion.id);
    res.json({ ok: true, inactividadMs: INACTIVIDAD_MS });
  } catch (err) {
    next(err);
  }
}

export { textoInactividad };