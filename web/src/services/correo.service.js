// Envio de correos con nodemailer (npm install nodemailer)
// Configura SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS y SMTP_FROM en el .env
let transporte = null;

async function obtenerTransporte() {
  if (transporte) return transporte;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error('Faltan SMTP_HOST, SMTP_USER o SMTP_PASS en el archivo .env');
  }

  let nodemailer;
  try {
    nodemailer = (await import('nodemailer')).default;
  } catch {
    throw new Error('Falta el paquete nodemailer. Ejecuta: npm install nodemailer');
  }

  const puerto = Number(SMTP_PORT) || 587;
  transporte = nodemailer.createTransport({
    host: SMTP_HOST,
    port: puerto,
    secure: puerto === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporte;
}

const escaparHtml = (texto) =>
  String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export async function enviarAvisoRegistro({ correo, nombre, numeroControl, carrera, rol }) {
  const tipo = rol === 'admin' ? 'Administrador' : 'Usuario';
  const lineaCarrera = carrera ? `Carrera: ${carrera}\n` : '';
  const htmlCarrera = carrera ? `<br>Carrera: <strong>${escaparHtml(carrera)}</strong>` : '';
  const t = await obtenerTransporte();
  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: correo,
    subject: 'Registro en la app para escanear botellas',
    text:
      `Hola ${nombre}:\n\n` +
      'Acabas de registrarte en la app para escanear botellas.\n\n' +
      `Número de control: ${numeroControl}\n` +
      `Tipo de cuenta: ${tipo}\n` +
      lineaCarrera + '\n' +
      'Si no fuiste tú, ignora este mensaje.',
    html:
      `<p>Hola <strong>${escaparHtml(nombre)}</strong>:</p>` +
      '<p>Acabas de registrarte en la app para escanear botellas.</p>' +
      `<p>Número de control: <strong>${escaparHtml(numeroControl)}</strong><br>` +
      `Tipo de cuenta: <strong>${tipo}</strong>${htmlCarrera}</p>` +
      '<p style="color:#777">Si no fuiste tú, ignora este mensaje.</p>',
  });
}
// Envía la constancia de reciclaje (PDF adjunto) al correo del usuario
export async function enviarConstancia({ correo, nombre, numeroControl, botellas, puntos }, pdf) {
  const t = await obtenerTransporte();
  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: correo,
    subject: 'Tu constancia de reciclaje',
    text:
      `Hola ${nombre}:\n\n` +
      'Te enviamos tu constancia de reciclaje en PDF.\n\n' +
      `Número de control: ${numeroControl}\n` +
      `Botellas recicladas: ${botellas}\n` +
      `Puntos acumulados: ${puntos}\n`,
    html:
      `<p>Hola <strong>${escaparHtml(nombre)}</strong>:</p>` +
      '<p>Te enviamos tu constancia de reciclaje en PDF.</p>' +
      `<p>Número de control: <strong>${escaparHtml(numeroControl)}</strong><br>` +
      `Botellas recicladas: <strong>${botellas}</strong><br>` +
      `Puntos acumulados: <strong>${puntos}</strong></p>`,
    attachments: [{
      filename: `constancia-reciclaje-${numeroControl}.pdf`,
      content: pdf,
      contentType: 'application/pdf',
    }],
  });
}
