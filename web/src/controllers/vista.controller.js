import Sesion from '../models/sesion.model.js';
import { INACTIVIDAD_MS } from '../config/sesion.js';
import { textoInactividad } from './auth.controller.js';

export async function dashboard(req, res, next) {
  try {
    // Abrir la pagina cuenta como actividad
    await Sesion.renovar(req.sesion.id);
    res.render('dashboard', {
      titulo: 'Clasificador de botellas',
      usuario: req.sesion.nombre,
      esAdmin: req.sesion.esAdmin,
      inactividadMs: INACTIVIDAD_MS,
      textoInactividad: textoInactividad(),
    });
  } catch (err) {
    next(err);
  }
}