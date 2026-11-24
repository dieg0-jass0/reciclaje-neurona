import { clasificarImagen, iaDisponible } from '../services/ia.service.js';
import { dbActiva } from '../config/db.js';
import Deteccion from '../models/deteccion.model.js';

export async function clasificar(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: "Falta el campo 'imagen' (jpg o png)" });
  }

  let resultado;
  try {
    resultado = await clasificarImagen(req.file.buffer, req.file.mimetype);
  } catch (err) {
    return res.status(502).json({ error: 'El servicio de IA no respondio', detalle: err.message });
  }

  try {
    const registro = await Deteccion.guardar(resultado);
    res.json(registro);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo guardar en MongoDB', detalle: err.message });
  }
}

export async function historial(req, res) {
  try {
    res.json(await Deteccion.listar(Number(req.query.limite) || 20));
  } catch (err) {
    res.status(500).json({ error: 'Error al leer el historial', detalle: err.message });
  }
}

export async function resumen(req, res) {
  try {
    res.json(await Deteccion.resumen());
  } catch (err) {
    res.status(500).json({ error: 'Error al calcular el resumen', detalle: err.message });
  }
}

export async function estado(req, res) {
  res.json({
    web: 'ok',
    ia: (await iaDisponible()) ? 'ok' : 'caido',
    db: dbActiva() ? 'ok' : 'caido',
  });
}
