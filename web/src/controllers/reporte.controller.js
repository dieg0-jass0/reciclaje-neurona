import Usuario from '../models/usuario.model.js';
import Deteccion from '../models/deteccion.model.js';
import { REGLAS } from '../services/conteo.service.js';
import { crearReportePdf } from '../utils/reporte-pdf.js';

const ZONA = 'America/Mexico_City';
const DIAS_GRAFICA = 14;
const MAX_FILAS = 200;

const fechaLarga = (d) => new Date(d).toLocaleDateString('es-MX', { timeZone: ZONA, day: 'numeric', month: 'long', year: 'numeric' });
const hora = (d) => new Date(d).toLocaleTimeString('es-MX', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
// 'AAAA-MM-DD' del día en la zona horaria de la recicladora
const claveDia = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: ZONA });

function ultimosDias(conteo) {
  const mapa = Object.fromEntries(conteo.map((c) => [c.dia, c.botellas]));
  const dias = [];
  for (let i = DIAS_GRAFICA - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    dias.push({
      etiqueta: d.toLocaleDateString('es-MX', { timeZone: ZONA, day: 'numeric', month: 'short' }).replace('.', ''),
      botellas: mapa[claveDia(d)] || 0,
    });
  }
  return dias;
}

async function enviarReporte(res, usuarioId) {
  const usuario = await Usuario.buscarPorId(usuarioId);
  if (!usuario) return res.status(404).send('No existe ese usuario. <a href="/">Volver</a>');

  const desde = new Date(Date.now() - (DIAS_GRAFICA + 1) * 86400000);
  const [resumen, conteo, botellas] = await Promise.all([
    Deteccion.resumenUsuario(usuarioId),
    Deteccion.porDia(usuarioId, desde, ZONA),
    Deteccion.listar(MAX_FILAS, usuarioId),
  ]);

  const pdf = await crearReportePdf({
    usuario,
    resumen: { ...resumen, puntosPorBotella: REGLAS.puntosPorBotella },
    dias: ultimosDias(conteo),
    filas: botellas.map((b) => ({
      fecha: fechaLarga(b.fecha),
      hora: hora(b.fecha),
      seguridad: `${Math.round(b.confianza * 100)} %`,
      puntos: `+${b.puntos}`,
    })),
    generado: `${fechaLarga(new Date())}, ${hora(new Date())}`,
  });

  const nombre = `reporte-reciclaje-${usuario.numeroControl}-${claveDia(new Date())}.pdf`;
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${nombre}"`,
    'Content-Length': pdf.length,
    'Cache-Control': 'no-store',
  });
  res.send(pdf);
}

// La persona con sesión descarga su propio reporte
export async function miReporte(req, res, next) {
  try {
    await enviarReporte(res, req.sesion.usuarioId);
  } catch (err) {
    next(err);
  }
}

// El administrador descarga el reporte de cualquier usuario
export async function reporteDeUsuario(req, res, next) {
  try {
    await enviarReporte(res, req.params.id);
  } catch (err) {
    next(err);
  }
}
