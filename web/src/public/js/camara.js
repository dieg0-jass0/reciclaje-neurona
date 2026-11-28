const $ = (id) => document.getElementById(id);

const video = $('video');
const selCam = $('camaras');
const btnPausa = $('pausa');
const visor = document.querySelector('.visor');
const veredicto = $('veredicto');
const nivel = $('nivel');
const canvas = document.createElement('canvas');

const INTERVALO_MS = 1000;
// Coordenadas de la silueta en el SVG (viewBox 0 0 120 300)
const FONDO_BOTELLA = 294;
const ALTO_BOTELLA = 294 - 22;

let ocupado = false;
let pausado = false;
let ultimoId = null;

const FORMA_BOTELLA = 'M20 6h10v8c0 3 7 5 7 11v40c0 3-2 5-5 5H18c-3 0-5-2-5-5V25c0-6 7-8 7-11z';
const FORMA_OTRO = 'M10 30c0-8 8-12 15-12s15 4 15 12v22c0 8-7 12-15 12s-15-4-15-12z';

// ---------- Veredicto y botella guía ----------
function mostrar(tipo, titular, porcentaje, destino) {
  veredicto.dataset.tipo = tipo;
  visor.dataset.tipo = tipo;
  $('titular').textContent = titular;
  $('porcentaje').textContent = porcentaje == null ? '—' : `${porcentaje}%`;
  $('destino').textContent = destino;

  const lleno = porcentaje == null ? 0 : porcentaje / 100;
  nivel.setAttribute('y', FONDO_BOTELLA - lleno * ALTO_BOTELLA);
}

function mostrarResultado({ esBotella, confianza }) {
  const pct = Math.round(confianza * 100);
  if (esBotella) {
    mostrar('botella', 'Botella de plástico', pct, 'Va al contenedor de plásticos.');
  } else {
    mostrar('otro', 'No es una botella', pct, 'Este objeto no va al contenedor de plásticos.');
  }
}

// ---------- Cámara ----------
async function listarCamaras() {
  // Se pide permiso primero; sin permiso el navegador no muestra los nombres
  const temporal = await navigator.mediaDevices.getUserMedia({ video: true });
  temporal.getTracks().forEach((t) => t.stop());

  const dispositivos = (await navigator.mediaDevices.enumerateDevices())
    .filter((d) => d.kind === 'videoinput');

  selCam.replaceChildren(...dispositivos.map((d, i) => {
    const op = document.createElement('option');
    op.value = d.deviceId;
    op.textContent = d.label || `Cámara ${i + 1}`;
    return op;
  }));

  await iniciarCamara(selCam.value);
}

async function iniciarCamara(deviceId) {
  if (video.srcObject) video.srcObject.getTracks().forEach((t) => t.stop());
  video.srcObject = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: deviceId } },
  });
  mostrar('espera', 'Analizando…', null, 'Pon un objeto frente a la cámara.');
}

async function analizarFrame() {
  if (ocupado || pausado || !video.videoWidth) return;
  ocupado = true;
  try {
    const ancho = Math.min(video.videoWidth, 480);
    canvas.width = ancho;
    canvas.height = Math.round((video.videoHeight / video.videoWidth) * ancho);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    const form = new FormData();
    form.append('imagen', blob, 'frame.jpg');

    const resp = await fetch('/api/clasificar', { method: 'POST', body: form });
    const datos = await resp.json();
    if (!resp.ok) throw new Error(datos.error || `El servidor respondió ${resp.status}`);

    if (!pausado) mostrarResultado(datos);
    await actualizarPanel();
  } catch (err) {
    mostrar('error', 'Sin resultado', null, err.message);
  } finally {
    ocupado = false;
  }
}

// ---------- Cinta y totales ----------
function crearFicha(h, esNueva) {
  const li = document.createElement('li');
  li.className = 'ficha' + (esNueva ? ' nueva' : '');
  li.dataset.tipo = h.esBotella ? 'botella' : 'otro';

  const pct = Math.round(h.confianza * 100);
  const hora = new Date(h.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const tipo = h.esBotella ? 'Botella' : 'Otro objeto';
  li.title = `${tipo}, ${pct}% de seguridad, ${hora}`;

  li.innerHTML = `<svg viewBox="0 0 50 72" aria-hidden="true"><path class="forma" d="${h.esBotella ? FORMA_BOTELLA : FORMA_OTRO}"/></svg>`;

  const fuerte = document.createElement('strong');
  fuerte.textContent = `${pct}%`;
  const tiempo = document.createElement('span');
  tiempo.textContent = hora;
  li.append(fuerte, tiempo);
  li.setAttribute('aria-label', li.title);
  return li;
}

async function actualizarPanel() {
  const [res, hist] = await Promise.all([
    fetch('/api/resumen').then((r) => r.json()),
    fetch('/api/historial?limite=14').then((r) => r.json()),
  ]);

  $('total').textContent = res.total;
  $('botellas').textContent = res.botellas;
  $('noBotellas').textContent = res.noBotellas;
  const porcion = res.total ? (res.botellas / res.total) * 100 : 0;
  $('barraBotellas').style.width = `${porcion}%`;
  $('barraResto').style.width = res.total ? `${100 - porcion}%` : '0%';

  const nuevoId = hist[0]?.id ?? null;
  $('historial').replaceChildren(...hist.map((h, i) => crearFicha(h, i === 0 && ultimoId !== null && nuevoId !== ultimoId)));
  ultimoId = nuevoId;
  $('cintaVacia').hidden = hist.length > 0;
}

// ---------- Servicios ----------
async function actualizarEstado() {
  try {
    const e = await fetch('/api/estado').then((r) => r.json());
    $('luzIA').dataset.estado = e.ia;
    $('luzDB').dataset.estado = e.db;
    $('luzIA').title = e.ia === 'ok' ? 'IA funcionando' : 'La IA no responde';
    $('luzDB').title = e.db === 'ok' ? 'Base de datos conectada' : 'Base de datos sin conexión';
  } catch {
    $('luzIA').dataset.estado = 'caido';
    $('luzDB').dataset.estado = 'caido';
  }
}

// ---------- Eventos ----------
selCam.addEventListener('change', () => iniciarCamara(selCam.value));

btnPausa.addEventListener('click', () => {
  pausado = !pausado;
  btnPausa.setAttribute('aria-pressed', String(pausado));
  btnPausa.textContent = pausado ? 'Reanudar análisis' : 'Pausar análisis';
  if (pausado) mostrar('pausa', 'En pausa', null, 'Pulsa «Reanudar análisis» para seguir clasificando.');
  else mostrar('espera', 'Analizando…', null, 'Pon un objeto frente a la cámara.');
});

actualizarEstado();
setInterval(actualizarEstado, 5000);
actualizarPanel().catch(() => {});

listarCamaras()
  .then(() => setInterval(analizarFrame, INTERVALO_MS))
  .catch((err) => {
    mostrar('error', 'Sin cámara', null, `No se pudo acceder a la cámara: ${err.message}. Revisa el permiso del navegador.`);
  });
