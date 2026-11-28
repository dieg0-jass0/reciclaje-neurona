// Reporte personal de reciclaje en PDF (tamaño carta, vertical).
// Usa los mismos colores y tipografías que el tablero.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const FUENTES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'fuentes');

const C = {
  hielo: '#E6EFF0',
  pet: '#CFE3E6',
  tinta: '#0F2E38',
  tintaSuave: '#4A6670',
  amarillo: '#F2C230',
};

const ANCHO = 612;
const ALTO = 792;
const M = 48; // margen
const UTIL = ANCHO - 2 * M;

// Silueta de la botella del tablero (viewBox 0 0 120 300)
const BOTELLA = 'M48 22H72V40C72 52 96 62 98 86V270C98 284 88 294 74 294H46C32 294 22 284 22 270V86C24 62 48 52 48 40Z';

const nf = (n) => Number(n).toLocaleString('es-MX');

function registrarFuentes(doc) {
  doc.registerFont('titulo', path.join(FUENTES, 'BigShouldersDisplay-ExtraBold.woff'));
  doc.registerFont('cifra', path.join(FUENTES, 'BigShouldersDisplay-Medium.woff'));
  doc.registerFont('texto', path.join(FUENTES, 'AtkinsonHyperlegible-Regular.ttf'));
  doc.registerFont('negrita', path.join(FUENTES, 'AtkinsonHyperlegible-Bold.ttf'));
}

function botella(doc, x, y, alto, { relleno, borde, ancho = 2 }) {
  const escala = alto / 300;
  doc.save().translate(x, y).scale(escala);
  doc.path(BOTELLA);
  if (relleno && borde) doc.lineWidth(ancho / escala).fillAndStroke(relleno, borde);
  else if (relleno) doc.fill(relleno);
  else doc.lineWidth(ancho / escala).stroke(borde);
  doc.roundedRect(44, 4, 32, 18, 3);
  if (relleno) doc.fill(borde || relleno); else doc.lineWidth(ancho / escala).stroke(borde);
  doc.restore();
}

function encabezado(doc, generado) {
  doc.rect(0, 0, ANCHO, 128).fill(C.tinta);
  doc.rect(0, 128, ANCHO, 8).fill(C.amarillo);

  doc.font('negrita').fontSize(11).fillColor(C.pet).text('Clasificador de botellas', M, 40);
  doc.font('titulo').fontSize(42).fillColor('#FFFFFF').text('Reporte de reciclaje', M, 56);
  doc.font('texto').fontSize(10).fillColor(C.pet)
    .text(`Generado el ${generado}`, M, 44, { width: UTIL, align: 'right' });

  botella(doc, ANCHO - M - 34, 62, 54, { borde: C.amarillo, ancho: 2 });
}

function persona(doc, usuario, y) {
  doc.font('negrita').fontSize(18).fillColor(C.tinta).text(usuario.nombre, M, y);
  const datos = [`Número de control: ${usuario.numeroControl}`];
  if (usuario.carrera) datos.push(usuario.carrera);
  doc.font('texto').fontSize(11).fillColor(C.tintaSuave).text(datos.join('     '), M, y + 26);
  return y + 58;
}

function marcador(doc, { puntos, botellas, puntosPorBotella }, y) {
  const alto = 150;
  const anchoTarjeta = 300;

  // Tarjeta amarilla de puntos
  doc.roundedRect(M, y, anchoTarjeta, alto, 10).fill(C.amarillo);
  doc.font('negrita').fontSize(12).fillColor(C.tinta).text('Puntos acumulados', M + 22, y + 20);
  doc.font('titulo').fontSize(80).fillColor(C.tinta).text(nf(puntos), M + 20, y + 36, { lineBreak: false });
  botella(doc, M + anchoTarjeta - 70, y + 22, 106, { borde: C.tinta, ancho: 2.5 });

  // Datos al lado
  const x = M + anchoTarjeta + 28;
  const ancho = UTIL - anchoTarjeta - 28;
  doc.font('texto').fontSize(11).fillColor(C.tintaSuave).text('Botellas recicladas', x, y + 14);
  doc.font('cifra').fontSize(46).fillColor(C.tinta).text(nf(botellas), x, y + 28);

  doc.moveTo(x, y + 88).lineTo(x + ancho, y + 88).lineWidth(1.5).stroke(C.pet);

  doc.font('texto').fontSize(11).fillColor(C.tintaSuave).text('Puntos por botella', x, y + 100);
  doc.font('cifra').fontSize(30).fillColor(C.tinta).text(nf(puntosPorBotella), x, y + 114);

  return y + alto + 36;
}

function grafica(doc, dias, y) {
  doc.font('negrita').fontSize(13).fillColor(C.tinta).text('Botellas por día, últimos 14 días', M, y);
  const top = y + 30;
  const alto = 110;
  const base = top + alto;
  const max = Math.max(1, ...dias.map((d) => d.botellas));
  const paso = UTIL / dias.length;
  const anchoBarra = paso * 0.62;

  dias.forEach((d, i) => {
    const x = M + i * paso + (paso - anchoBarra) / 2;
    const h = d.botellas ? Math.max(4, (d.botellas / max) * (alto - 18)) : 0;
    if (h) {
      doc.roundedRect(x, base - h, anchoBarra, h, 3).fill(C.amarillo);
      doc.font('negrita').fontSize(9).fillColor(C.tinta)
        .text(String(d.botellas), x - 6, base - h - 13, { width: anchoBarra + 12, align: 'center' });
    }
    doc.font('texto').fontSize(8.5).fillColor(C.tintaSuave)
      .text(d.etiqueta, x - 8, base + 6, { width: anchoBarra + 16, align: 'center' });
  });
  doc.moveTo(M, base).lineTo(M + UTIL, base).lineWidth(1.5).stroke(C.tinta);
  return base + 40;
}

const COLUMNAS = [
  { titulo: 'Fecha', clave: 'fecha', ancho: 0.34 },
  { titulo: 'Hora', clave: 'hora', ancho: 0.22 },
  { titulo: 'Seguridad del modelo', clave: 'seguridad', ancho: 0.26, derecha: true },
  { titulo: 'Puntos', clave: 'puntos', ancho: 0.18, derecha: true },
];
const ALTO_FILA = 22;

function filaTitulos(doc, y) {
  doc.rect(M, y, UTIL, ALTO_FILA).fill(C.tinta);
  let x = M;
  for (const c of COLUMNAS) {
    const w = c.ancho * UTIL;
    doc.font('negrita').fontSize(9.5).fillColor('#FFFFFF')
      .text(c.titulo, x + 10, y + 6.5, { width: w - 20, align: c.derecha ? 'right' : 'left' });
    x += w;
  }
  return y + ALTO_FILA;
}

function tabla(doc, filas, total, y, nuevaPagina) {
  doc.font('negrita').fontSize(13).fillColor(C.tinta).text('Últimas botellas recicladas', M, y);
  if (total > filas.length) {
    doc.font('texto').fontSize(9.5).fillColor(C.tintaSuave)
      .text(`Se muestran las ${filas.length} más recientes de ${nf(total)}.`, M, y + 3, { width: UTIL, align: 'right' });
  }
  y = filaTitulos(doc, y + 24);

  filas.forEach((f, i) => {
    if (y + ALTO_FILA > ALTO - M - 24) {
      y = filaTitulos(doc, nuevaPagina());
    }
    if (i % 2 === 1) doc.rect(M, y, UTIL, ALTO_FILA).fill(C.hielo);
    let x = M;
    for (const c of COLUMNAS) {
      const w = c.ancho * UTIL;
      doc.font(c.clave === 'puntos' ? 'negrita' : 'texto').fontSize(10).fillColor(C.tinta)
        .text(f[c.clave], x + 10, y + 6, { width: w - 20, align: c.derecha ? 'right' : 'left' });
      x += w;
    }
    y += ALTO_FILA;
  });
  doc.moveTo(M, y).lineTo(M + UTIL, y).lineWidth(1.5).stroke(C.pet);
}

function vacio(doc, y) {
  doc.roundedRect(M, y, UTIL, 90, 10).fill(C.hielo);
  botella(doc, M + 24, y + 18, 54, { borde: C.tintaSuave, ancho: 1.5 });
  doc.font('negrita').fontSize(13).fillColor(C.tinta)
    .text('Todavía no hay botellas registradas', M + 64, y + 26);
  doc.font('texto').fontSize(10.5).fillColor(C.tintaSuave)
    .text('Muestra una botella a la cámara del clasificador para empezar a sumar puntos.', M + 64, y + 46, { width: UTIL - 90 });
}

/**
 * @param {object} datos
 * @param {{ nombre, numeroControl, carrera }} datos.usuario
 * @param {{ puntos, botellas, puntosPorBotella }} datos.resumen
 * @param {{ etiqueta, botellas }[]} datos.dias  14 días, del más antiguo al más reciente
 * @param {{ fecha, hora, seguridad, puntos }[]} datos.filas
 * @param {string} datos.generado
 * @returns {Promise<Buffer>}
 */
export function crearReportePdf({ usuario, resumen, dias, filas, generado }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 0,
      bufferPages: true,
      info: { Title: `Reporte de reciclaje - ${usuario.nombre}`, Author: 'Clasificador de botellas' },
    });
    const partes = [];
    doc.on('data', (p) => partes.push(p));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);

    registrarFuentes(doc);
    encabezado(doc, generado);

    let y = persona(doc, usuario, 164);
    y = marcador(doc, resumen, y);

    if (resumen.botellas === 0) {
      vacio(doc, y);
    } else {
      y = grafica(doc, dias, y);
      tabla(doc, filas, resumen.botellas, y, () => { doc.addPage(); return M; });
    }

    // Pie en todas las páginas
    const { start, count } = doc.bufferedPageRange();
    for (let i = start; i < start + count; i++) {
      doc.switchToPage(i);
      doc.font('texto').fontSize(8.5).fillColor(C.tintaSuave)
        .text(`${usuario.nombre}  |  Página ${i + 1} de ${count}`, M, ALTO - M + 12, { width: UTIL, align: 'right', lineBreak: false });
    }
    doc.end();
  });
}
