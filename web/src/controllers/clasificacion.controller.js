import { clasificarImagen, iaDisponible } from '../services/ia.service.js';
import { registrarFrame, deshacerConteo, REGLAS } from '../services/conteo.service.js';
import { dbActiva } from '../config/db.js';
import Deteccion from '../models/deteccion.model.js';

// Analiza un frame. Solo se guarda en MongoDB cuando el frame confirma una
// botella NUEVA de esta persona (ver conteo.service.js).
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

  const { usuarioId } = req.sesion;
  const decision = registrarFrame(usuarioId, resultado);
  const respuesta = { ...resultado, ...decision };

  if (decision.accion !== 'contar') return res.json(respuesta);

  try {
    const entrega = await Deteccion.guardar({
      esBotella: true,
      confianza: resultado.confianza,
      puntos: REGLAS.puntosPorBotella,
      usuarioId,
    });
    res.json({ ...respuesta, entrega });
  } catch (err) {
    deshacerConteo(usuarioId);
    res.status(500).json({ error: 'No se pudo guardar en MongoDB', detalle: err.message });
  }
}

// Botellas recicladas por la persona con sesión
export async function historial(req, res) {
  try {
    const limite = Math.min(Math.max(Number(req.query.limite) || 20, 1), 100);
    res.json(await Deteccion.listar(limite, req.sesion.usuarioId));
  } catch (err) {
    res.status(500).json({ error: 'Error al leer el historial', detalle: err.message });
  }
}

// Puntaje de la persona con sesión
export async function resumen(req, res) {
  try {
    const propio = await Deteccion.resumenUsuario(req.sesion.usuarioId);
    res.json({ ...propio, puntosPorBotella: REGLAS.puntosPorBotella });
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
