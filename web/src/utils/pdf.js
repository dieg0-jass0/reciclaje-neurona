// Generador de PDF sencillo (tablas de texto) sin dependencias externas.
// Hoja tamano carta horizontal, fuente Helvetica, acentos y ñ soportados.

const ANCHO = 792;
const ALTO = 612;
const MARGEN = 36;
const ALTO_FILA = 20;

// Convierte texto a bytes Windows-1252 y escapa caracteres especiales de PDF
function textoPdf(texto) {
  let salida = '';
  for (const c of String(texto ?? '')) {
    const code = c.codePointAt(0);
    let b;
    if (code < 128 || (code >= 160 && code <= 255)) b = code;
    else if (c === '–' || c === '—') b = 45;
    else if (c === '…') b = 133;
    else b = 63; // '?'
    const ch = String.fromCharCode(b);
    salida += ch === '\\' || ch === '(' || ch === ')' ? '\\' + ch : ch;
  }
  return salida;
}

// Ancho aproximado de un texto en Helvetica
function anchoTexto(texto, tam, negrita = false) {
  let unidades = 0;
  for (const c of String(texto)) {
    if ('iljtf.,:;\'!|I '.includes(c)) unidades += 0.28;
    else if ('mwMW@'.includes(c)) unidades += 0.85;
    else if (c >= 'A' && c <= 'Z') unidades += 0.67;
    else unidades += 0.5;
  }
  return unidades * tam * (negrita ? 1.07 : 1);
}

function recortar(texto, anchoMax, tam, negrita) {
  let t = String(texto ?? '');
  if (anchoTexto(t, tam, negrita) <= anchoMax) return t;
  while (t.length > 1 && anchoTexto(t + '...', tam, negrita) > anchoMax) t = t.slice(0, -1);
  return t + '...';
}

const fmt = (n) => Number(n.toFixed(2)).toString();

export function crearPdfTabla({ titulo, subtitulo = '', columnas, filas }) {
  const anchoTabla = columnas.reduce((s, c) => s + c.ancho, 0);
  const escala = Math.min(1, (ANCHO - 2 * MARGEN) / anchoTabla);
  const cols = columnas.map((c) => ({ ...c, ancho: c.ancho * escala }));

  const yInicioTabla = ALTO - MARGEN - 52;
  const filasPorPagina = Math.floor((yInicioTabla - MARGEN - 24) / ALTO_FILA);
  const paginas = [];
  for (let i = 0; i < Math.max(filas.length, 1); i += filasPorPagina) {
    paginas.push(filas.slice(i, i + filasPorPagina));
  }

  const contenidos = paginas.map((filasPagina, numPagina) => {
    const ops = [];
    const texto = (t, x, y, tam, negrita = false, color = '0.13 0.13 0.13') =>
      ops.push(`BT ${color} rg /${negrita ? 'F2' : 'F1'} ${tam} Tf ${fmt(x)} ${fmt(y)} Td (${textoPdf(t)}) Tj ET`);

    // Encabezado
    texto(titulo, MARGEN, ALTO - MARGEN - 16, 16, true);
    if (subtitulo) texto(subtitulo, MARGEN, ALTO - MARGEN - 32, 9.5, false, '0.4 0.4 0.4');

    // Fila de titulos
    let y = yInicioTabla;
    ops.push(`0.1 0.5 0.27 rg ${MARGEN} ${fmt(y - 6)} ${fmt(anchoTabla * escala)} ${ALTO_FILA} re f`);
    let x = MARGEN;
    for (const c of cols) {
      const t = recortar(c.titulo, c.ancho - 10, 9, true);
      const tx = c.alinear === 'derecha' ? x + c.ancho - 6 - anchoTexto(t, 9, true) : x + 6;
      texto(t, tx, y, 9, true, '1 1 1');
      x += c.ancho;
    }

    // Filas
    filasPagina.forEach((fila, i) => {
      y -= ALTO_FILA;
      if (i % 2 === 1) ops.push(`0.95 0.96 0.95 rg ${MARGEN} ${fmt(y - 6)} ${fmt(anchoTabla * escala)} ${ALTO_FILA} re f`);
      let cx = MARGEN;
      for (const c of cols) {
        const t = recortar(fila[c.clave], c.ancho - 14, 9);
        const tx = c.alinear === 'derecha' ? cx + c.ancho - 6 - anchoTexto(t, 9) : cx + 6;
        texto(t, tx, y, 9);
        cx += c.ancho;
      }
    });
    if (filas.length === 0) texto('No hay usuarios para mostrar.', MARGEN + 6, y - ALTO_FILA, 9, false, '0.5 0.5 0.5');

    // Linea final y pie
    ops.push(`0.8 0.82 0.8 RG 0.6 w ${MARGEN} ${fmt(y - 7)} m ${fmt(MARGEN + anchoTabla * escala)} ${fmt(y - 7)} l S`);
    texto(`Página ${numPagina + 1} de ${paginas.length}`, ANCHO - MARGEN - 70, MARGEN - 10, 8, false, '0.5 0.5 0.5');
    return Buffer.from(ops.join('\n'), 'latin1');
  });

  // Armar objetos PDF
  const objetos = [];
  const agregar = (cuerpo) => objetos.push(cuerpo) && objetos.length;
  const idCatalogo = agregar(null);
  const idPaginas = agregar(null);
  const idF1 = agregar(Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'));
  const idF2 = agregar(Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'));
  const idsPagina = contenidos.map((c) => {
    const idC = agregar(Buffer.concat([Buffer.from(`<< /Length ${c.length} >>\nstream\n`), c, Buffer.from('\nendstream')]));
    return agregar(Buffer.from(
      `<< /Type /Page /Parent ${idPaginas} 0 R /MediaBox [0 0 ${ANCHO} ${ALTO}] ` +
      `/Resources << /Font << /F1 ${idF1} 0 R /F2 ${idF2} 0 R >> >> /Contents ${idC} 0 R >>`
    ));
  });
  objetos[idCatalogo - 1] = Buffer.from(`<< /Type /Catalog /Pages ${idPaginas} 0 R >>`);
  objetos[idPaginas - 1] = Buffer.from(`<< /Type /Pages /Kids [${idsPagina.map((i) => `${i} 0 R`).join(' ')}] /Count ${idsPagina.length} >>`);

  const partes = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
  let posicion = partes[0].length;
  const offsets = [];
  objetos.forEach((cuerpo, i) => {
    offsets.push(posicion);
    const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), cuerpo, Buffer.from('\nendobj\n')]);
    partes.push(b);
    posicion += b.length;
  });
  const xref =
    `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size ${objetos.length + 1} /Root ${idCatalogo} 0 R >>\nstartxref\n${posicion}\n%%EOF\n`;
  partes.push(Buffer.from(xref));
  return Buffer.concat(partes);
}