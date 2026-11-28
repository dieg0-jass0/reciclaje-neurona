import Usuario from '../models/usuario.model.js';
import Deteccion from '../models/deteccion.model.js';
import { REGLAS } from '../services/conteo.service.js';
import { crearReportePdf, crearConstanciaPdf } from '../utils/reporte-pdf.js';
import { enviarConstancia } from '../services/correo.service.js';

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
  const resumen = { botellas: usuario.botellas, puntos: usuario.puntos };
  const [conteo, botellas] = await Promise.all([
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

// La persona con sesión recibe su constancia (PDF sencillo) en el correo
// con el que se registró. Máximo un envío por minuto por persona.
const ESPERA_ENVIO_MS = 60 * 1000;
const ultimoEnvio = new Map();

export async function enviarMiConstancia(req, res) {
  const { usuarioId } = req.sesion;
  const espera = (ultimoEnvio.get(usuarioId) || 0) + ESPERA_ENVIO_MS - Date.now();
  if (espera > 0) {
    return res.status(429).json({ error: `Ya enviamos tu constancia. Puedes pedir otra en ${Math.ceil(espera / 1000)} s.` });
  }

  let usuario;
  try {
    usuario = await Usuario.buscarPorId(usuarioId);
    if (!usuario) return res.status(404).json({ error: 'Tu cuenta ya no existe.' });
  } catch (err) {
    return res.status(500).json({ error: 'No se pudieron leer tus datos', detalle: err.message });
  }

  try {
    const pdf = await crearConstanciaPdf({ usuario, generado: `${fechaLarga(new Date())}, ${hora(new Date())}` });
    ultimoEnvio.set(usuarioId, Date.now());
    await enviarConstancia(usuario, pdf);
    res.json({ enviado: true, correo: usuario.correo });
  } catch (err) {
    ultimoEnvio.delete(usuarioId);
    console.error(`No se pudo enviar la constancia a ${usuario.correo}:`, err.message);
    res.status(502).json({ error: 'No se pudo enviar el correo. Intenta más tarde o avisa al administrador.', detalle: err.message });
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
