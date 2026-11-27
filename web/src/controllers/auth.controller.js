import bcrypt from 'bcryptjs';
import Usuario from '../models/usuario.model.js';

const RE_CONTROL = /^[A-Za-z0-9]{6,8}$/;
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function verLogin(req, res) {
  res.render('login', { titulo: 'Iniciar sesión', exito: req.query.registrado ? 'Cuenta creada. Ya puedes iniciar sesión.' : null });
}

export function verRegistro(req, res) {
  res.render('registro', { titulo: 'Crear cuenta' });
}

export async function registrar(req, res) {
  const numeroControl = (req.body.numeroControl || '').trim().toUpperCase();
  const nombreCompleto = (req.body.nombreCompleto || '').trim().replace(/\s+/g, ' ');
  const correo = (req.body.correo || '').trim().toLowerCase();
  const carrera = (req.body.carrera || '').trim();
  const { password = '', password2 = '' } = req.body;
  const valores = { numeroControl, nombreCompleto, correo, carrera };

  const fallar = (error) => res.status(400).render('registro', { titulo: 'Crear cuenta', error, valores });

  if (!RE_CONTROL.test(numeroControl)) return fallar('El número de control debe tener de 6 a 8 letras o números.');
  if (nombreCompleto.split(' ').length < 2) return fallar('Escribe tu nombre completo (nombre y apellidos).');
  if (!RE_CORREO.test(correo)) return fallar('El correo no es válido.');
  if (!carrera) return fallar('Indica la carrera que estudias.');
  if (password.length < 8) return fallar('La contraseña debe tener al menos 8 caracteres.');
  if (password !== password2) return fallar('Las contraseñas no coinciden.');

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await Usuario.create({ numeroControl, nombreCompleto, correo, carrera, passwordHash });
    res.redirect('/login?registrado=1');
  } catch (err) {
    if (err.code === 11000) {
    const campo = err.keyPattern && err.keyPattern.correo
        ? 'correo'
        : 'número de control';

    return fallar(`Ya existe una cuenta con ese ${campo}.`);
}
    console.error(err);
    res.status(500).render('registro', { titulo: 'Crear cuenta', error: 'Error al crear la cuenta.', valores });
  }
}

export async function iniciarSesion(req, res) {
  const numeroControl = (req.body.numeroControl || '').trim().toUpperCase();
  const { password = '' } = req.body;
  const fallar = () =>
    res.status(401).render('login', { titulo: 'Iniciar sesión', error: 'Número de control o contraseña incorrectos.', valores: { numeroControl } });

  try {
    const usuario = await Usuario.findOne({ numeroControl });
    if (!usuario || !(await bcrypt.compare(password, usuario.passwordHash))) return fallar();

    // regenerar la sesion evita "session fixation"
    req.session.regenerate((err) => {
      if (err) return res.status(500).send('Error de sesión');
      req.session.usuario = {
        id: String(usuario._id),
        numeroControl: usuario.numeroControl,
        nombreCompleto: usuario.nombreCompleto,
        carrera: usuario.carrera,
      };
      res.redirect('/');
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('login', { titulo: 'Iniciar sesión', error: 'Error del servidor.' });
  }
}

export function cerrarSesion(req, res) {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
}
