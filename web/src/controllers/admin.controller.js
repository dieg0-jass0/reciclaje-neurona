import Usuario, { CARRERAS } from '../models/usuario.model.js';
import Deteccion from '../models/deteccion.model.js';
import Sesion from '../models/sesion.model.js';
import { crearPdfTabla } from '../utils/pdf.js';
import { INACTIVIDAD_MS } from '../config/sesion.js';
import { textoInactividad } from './auth.controller.js';

const ZONA = 'America/Mexico_City';
const fecha = (d) => (d ? new Date(d).toLocaleDateString('es-MX', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
const fechaHora = (d) => new Date(d).toLocaleString('es-MX', { timeZone: ZONA, dateStyle: 'short', timeStyle: 'short' });

function leerFiltros(query) {
  const carrera = CARRERAS.includes(query.carrera) ? query.carrera : '';
  const buscar = String(query.buscar || '').trim().slice(0, 60);
  return { carrera, buscar };
}

async function usuariosConEscaneos(filtros) {
  const usuarios = await Usuario.listar(filtros);
  return usuarios.map((u) => ({
    ...u,
    registro: fecha(u.creado),
  }));
}

export async function panel(req, res, next) {
  try {
    const filtros = leerFiltros(req.query);
    const [usuarios, porCarrera, resumen] = await Promise.all([
      usuariosConEscaneos(filtros),
      Usuario.contarPorCarrera(),
      Deteccion.resumen(),
    ]);
    const totalUsuarios = porCarrera.reduce((s, c) => s + c.total, 0);

    // Abrir la pagina cuenta como actividad
    await Sesion.renovar(req.sesion.id);

    const params = new URLSearchParams();
    if (filtros.carrera) params.set('carrera', filtros.carrera);
    if (filtros.buscar) params.set('buscar', filtros.buscar);

    res.render('admin', {
      titulo: 'Administrador',
      usuario: req.sesion.nombre,
      inactividadMs: INACTIVIDAD_MS,
      textoInactividad: textoInactividad(),
      totalUsuarios,
      resumen,
      porCarrera,
      usuarios: usuarios.map((u) => ({ ...u, soyYo: u.id === req.sesion.usuarioId })),
      carreras: CARRERAS.map((nombre) => ({ nombre, seleccionada: nombre === filtros.carrera })),
      buscar: filtros.buscar,
      hayFiltros: Boolean(filtros.carrera || filtros.buscar),
      enlacePdf: '/admin/usuarios.pdf' + (params.toString() ? `?${params}` : ''),
      aviso: req.query.eliminado ? 'Usuario eliminado.' : null,
    });
  } catch (err) {
    next(err);
  }
}

export async function pdfUsuarios(req, res, next) {
  try {
    const filtros = leerFiltros(req.query);
    const usuarios = await usuariosConEscaneos(filtros);

    const detalle = [
      `Generado: ${fechaHora(new Date())}`,
      `Total: ${usuarios.length} usuario${usuarios.length === 1 ? '' : 's'}`,
      filtros.carrera && `Carrera: ${filtros.carrera}`,
      filtros.buscar && `Búsqueda: "${filtros.buscar}"`,
    ].filter(Boolean).join('   ·   ');

    const pdf = crearPdfTabla({
      titulo: 'Usuarios registrados - App para escanear botellas',
      subtitulo: detalle,
      columnas: [
        { titulo: 'No. control', clave: 'numeroControl', ancho: 80 },
        { titulo: 'Nombre completo', clave: 'nombre', ancho: 160 },
        { titulo: 'Correo', clave: 'correo', ancho: 165 },
        { titulo: 'Carrera', clave: 'carrera', ancho: 165 },
        { titulo: 'Registro', clave: 'registro', ancho: 65 },
        { titulo: 'Botellas', clave: 'botellas', ancho: 45, alinear: 'derecha' },
        { titulo: 'Puntos', clave: 'puntos', ancho: 40, alinear: 'derecha' },
      ],
      filas: usuarios,
    });

    const nombre = `usuarios-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Content-Length': pdf.length,
    });
    res.send(pdf);
  } catch (err) {
    next(err);
  }
}

export async function eliminarUsuario(req, res, next) {
  try {
    const { id } = req.params;
    if (id === req.sesion.usuarioId) {
      return res.status(400).send('No puedes eliminar tu propia cuenta. <a href="/admin">Volver</a>');
    }
    await Usuario.eliminar(id);
    await Sesion.eliminarDeUsuario(id);
    res.redirect('/admin?eliminado=1');
  } catch (err) {
    next(err);
  }
}